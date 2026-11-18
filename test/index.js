const { test } = require('brittle')
const Corestore = require('corestore')
const PearRuntime = require('../bare')

test('clearUpgradeDrive clears cached content and retains metadata', async (t) => {
  const dir = await t.tmp()
  const store = new Corestore(dir)
  const core = store.get({ name: 'upgrade' })
  await core.ready()
  const upgrade = 'pear://' + core.key.toString('hex')
  await core.close()
  const runtime = new PearRuntime({
    dir,
    store,
    swarm: { destroy: () => Promise.resolve() },
    upgrade,
    name: 'app',
    updates: false
  })
  t.teardown(async () => {
    await runtime.close()
    await store.close()
  })
  await runtime.ready()
  const drive = runtime.updater.drive
  await drive.put('/update', Buffer.from('downloaded update'))
  t.ok(await drive.has('/update'))

  await runtime.clearUpgradeDrive()

  t.absent(await drive.has('/update'))
  t.ok(await drive.exists('/update'))
})
