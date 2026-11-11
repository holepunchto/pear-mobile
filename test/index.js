const { test } = require('brittle')
const Corestore = require('corestore')
const PearRuntime = require('../bare')

test('clearUpgradeDrive delegates to the upgrade drive', async (t) => {
  t.plan(2)
  const runtime = await createRuntime(t)
  const result = { blocks: 4 }
  runtime.updater.drive.clearAll = () => {
    t.pass('calls clearAll')
    return result
  }

  t.is(await runtime.clearUpgradeDrive(), result)
})

test('clearUpgradeDrive propagates clearing errors', async (t) => {
  const runtime = await createRuntime(t)
  runtime.updater.drive.clearAll = () => Promise.reject(new Error('cannot clear content'))

  await t.exception(runtime.clearUpgradeDrive(), /cannot clear content/)
})

test('clearUpgradeDrive handles an empty drive', async (t) => {
  const runtime = await createRuntime(t)

  t.is(await runtime.clearUpgradeDrive(), null)
})

async function createRuntime(t) {
  const dir = await t.tmp()
  const store = new Corestore(dir)
  const runtime = new PearRuntime({
    dir,
    store,
    swarm: { destroy: () => Promise.resolve() },
    upgrade: 'pear://' + '01'.repeat(32),
    name: 'app',
    updates: false
  })
  t.teardown(async () => {
    await runtime.close()
    await store.close()
  })
  await runtime.ready()
  return runtime
}
