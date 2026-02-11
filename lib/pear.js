const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const path = require('bare-path')
const ReadyResource = require('ready-resource')
const RPC = require('bare-rpc')

class PearRuntime extends ReadyResource {
  constructor(config) {
    super()

    const dir = config.dir

    this.dir = dir
    this.version = config.version || 0
    this.storage = path.join(dir, 'app-storage')
    this.app = config.app
    this.name = this.app && path.basename(this.app)
    this.key = config.key
    this.length = config.length
    this.fork = config.fork || 0
    this.link = 'pear://' + this.fork + '.' + this.length + '.' + this.key
    this.bundled = config.bundled || !!this.app
    this.store = config.store || new Corestore(path.join(dir, 'pear-runtime/corestore'))
    this.drive = new Hyperdrive(this.store, this.key)
    this.swarm = config.swarm || null

    this.ready().catch(noop)
  }

  async _open() {
    await this.drive.ready()

    if (!this.swarm) {
      const keyPair = await this.store.createKeyPair('pear-container')
      this.swarm = new Hyperswarm({ keyPair })
    }

    this.swarm.join(this.drive.core.discoveryKey, { client: true, server: false })

    this.drive.core.on('append', () => this.emit('updated'))
  }

  async _close() {
    await this.drive.close()
    await this.store.destroy()
    await this.swarm.destroy()
  }
}

function noop() {}

const rpc = new RPC(BareKit.IPC, (req) => {})

const config = JSON.parse(Bare.argv[0])
const app = new PearRuntime(config)
app.on('updated', () => {
  const req = rpc.request('updated')
  req.send()
})
