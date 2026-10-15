const { test } = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const fs = require('bare-fs')
const path = require('bare-path')
const PearRuntime = require('../bare')

test('clearUpgradeDrive preserves application and unrelated shared-store data', async (t) => {
  t.timeout(5000)
  const dir = await t.tmp()
  const store = new Corestore(path.join(dir, 'corestore'))
  const seed = new Hyperdrive(store.namespace('upgrade'))
  const other = new Hyperdrive(store.namespace('application'))
  const core = store.get({ name: 'application-data', valueEncoding: 'utf-8' })
  await seed.put('/app.bundle', Buffer.from('old bundle'))
  await seed.put('/app.bundle', Buffer.from('new bundle'))
  await seed.put('/package.json', Buffer.from('{"version":"2.0.0"}'))
  await other.put('/data', Buffer.from('application drive'))
  await core.append('application core')

  const key = seed.key
  const metadataLength = seed.core.length
  const contentLength = seed.blobs.core.length
  await seed.close()
  const runtime = createRuntime(dir, store, key)
  const drive = runtime.updater.drive
  t.teardown(async () => {
    await other.close()
    await core.close()
    await runtime.close()
  })

  const app = path.join(runtime.updater.app, 'app.bundle')
  const staged = path.join(dir, 'pear-runtime', 'next', 'app.bundle')
  const data = path.join(runtime.storage, 'data')
  for (const file of [app, staged, data]) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'keep')
  }

  await runtime.ready()
  t.ok(await drive.core.has(0, metadataLength), 'metadata is cached')
  t.ok(await drive.blobs.core.has(0, contentLength), 'historical content is cached')

  await runtime.clearUpgradeDrive()

  t.is(await availableBlocks(drive.core), 0, 'all upgrade metadata blocks are cleared')
  t.is(await availableBlocks(drive.blobs.core), 0, 'all historical content blocks are cleared')
  t.is(drive.core.length, metadataLength, 'metadata history length is retained')
  t.is(drive.blobs.core.length, contentLength, 'content history length is retained')
  t.is(await core.get(0), 'application core')
  t.is((await other.get('/data')).toString(), 'application drive')
  for (const file of [app, staged, data]) t.is(fs.readFileSync(file, 'utf-8'), 'keep')
  t.absent(runtime.updater.drive.closed, 'upgrade drive remains open')
  t.absent(runtime.updater.drive.blobs.core.closed, 'content session remains open')
  await t.execution(runtime.clearUpgradeDrive(), 'repeated cleanup succeeds')
})

test('clearUpgradeDrive returns for an empty offline drive', async (t) => {
  t.timeout(5000)
  const dir = await t.tmp()
  const source = new Corestore(path.join(dir, 'source'))
  const drive = new Hyperdrive(source)
  await drive.ready()
  const store = new Corestore(path.join(dir, 'corestore'))
  const runtime = createRuntime(dir, store, drive.key)
  t.teardown(async () => {
    await runtime.close()
    await drive.close()
    await source.close()
  })

  await t.execution(
    runtime.clearUpgradeDrive(),
    'cleanup opens the runtime without waiting for peers'
  )
  t.is(runtime.updater.drive.core.length, 0)
  await t.execution(runtime.clearUpgradeDrive(), 'repeated offline cleanup succeeds')
})

test('clearUpgradeDrive clears offline content when metadata is no longer cached', async (t) => {
  t.timeout(10000)
  const dir = await t.tmp()
  const source = new Corestore(path.join(dir, 'source'))
  const drive = new Hyperdrive(source)
  await drive.put('/app.bundle', Buffer.from('cached bundle'))
  const storage = path.join(dir, 'corestore')
  const store = new Corestore(storage)
  const downloaded = new Hyperdrive(store, drive.key)
  const disconnect = replicate(source, store)
  t.teardown(async () => {
    disconnect()
    await drive.close()
    await source.close()
  })

  await downloaded.core.download({ start: 0, end: drive.core.length }).done()
  t.is((await downloaded.get('/app.bundle')).toString(), 'cached bundle')
  await downloaded.core.clear(0, downloaded.core.length)
  disconnect()
  await downloaded.close()
  await store.close()

  const reopened = new Corestore(storage)
  const runtime = createRuntime(dir, reopened, drive.key)
  t.teardown(() => runtime.close())
  await runtime.ready()
  t.absent(runtime.updater.drive.blobs, 'metadata is unavailable offline')
  const content = reopened.get({ key: drive.contentKey })
  t.teardown(() => content.close(), { order: -1 })
  await content.ready()
  t.ok(await content.has(0, content.length), 'content remains cached without metadata')

  await runtime.clearUpgradeDrive()

  t.is(await availableBlocks(content), 0, 'content is cleared using its derived key')
  await t.execution(runtime.clearUpgradeDrive(), 'repeated cleanup needs no metadata or peer')
})

test('upgrade drive can download subsequent updates after cleanup', async (t) => {
  t.timeout(10000)
  const dir = await t.tmp()
  const source = new Corestore(path.join(dir, 'source'))
  const drive = new Hyperdrive(source)
  await drive.put('/package.json', Buffer.from('{"version":"1.0.0"}'))
  await drive.put('/app.bundle', Buffer.from('first bundle'))
  const store = new Corestore(path.join(dir, 'corestore'))
  const runtime = createRuntime(dir, store, drive.key)
  const disconnect = replicate(source, store)
  t.teardown(async () => {
    disconnect()
    await runtime.close()
    await drive.close()
    await source.close()
  })

  await runtime.ready()
  const upgrade = runtime.updater.drive
  await upgrade.core.download({ start: 0, end: drive.core.length }).done()
  t.is((await upgrade.get('/app.bundle')).toString(), 'first bundle')
  const key = upgrade.key
  await runtime.clearUpgradeDrive()

  await drive.put('/package.json', Buffer.from('{"version":"2.0.0"}'))
  await drive.put('/app.bundle', Buffer.from('second bundle'))
  await upgrade.core.download({ start: 0, end: drive.core.length }).done()
  t.alike(upgrade.key, key, 'upgrade identity is retained')
  t.is(JSON.parse(await upgrade.get('/package.json')).version, '2.0.0')
  t.is((await upgrade.get('/app.bundle')).toString(), 'second bundle')

  await runtime.clearUpgradeDrive()
  t.is(await availableBlocks(upgrade.core), 0, 'subsequent metadata can be cleared')
  t.is(await availableBlocks(upgrade.blobs.core), 0, 'subsequent content can be cleared')
})

function createRuntime(dir, store, key) {
  return new PearRuntime({
    dir,
    store,
    swarm: { destroy: () => Promise.resolve() },
    upgrade: 'pear://' + key.toString('hex'),
    name: 'app',
    updates: false
  })
}

function replicate(source, target) {
  const outgoing = source.replicate(true)
  const incoming = target.replicate(false)
  outgoing.pipe(incoming).pipe(outgoing)
  return () => {
    outgoing.destroy()
    incoming.destroy()
  }
}

async function availableBlocks(core) {
  let blocks = 0
  for (let i = 0; i < core.length; i++) {
    if (await core.has(i)) blocks++
  }
  return blocks
}
