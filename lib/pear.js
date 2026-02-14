/* global BareKit */

const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const path = require('bare-path')
const ReadyResource = require('ready-resource')
const RPC = require('bare-rpc')
const plink = require('pear-link')
const hid = require('hypercore-id-encoding')
const Localdrive = require('localdrive')

class PearRuntime extends ReadyResource {
  constructor(config) {
    super()
    const { drive: upgrade } = plink.parse(config.upgrade)
    this.dir = config.dir
    this.version = config.version || 0
    this.app = config.app
    this.name = this.app && path.basename(this.app)
    this.key = hid.decode(upgrade.key)
    this.length = upgrade.length || 0
    this.fork = upgrade.fork || 0
    this.link = plink.serialize({ drive: { fork: this.fork, length: this.length, key: this.key }})
    this.bundled = config.bundled || !!this.app
    this.isDev = config.isDev
    this.store = config.store || new Corestore(path.join(this.dir, 'corestore'))
    this.drive = new Hyperdrive(this.store, this.key)
    this.swarm = config.swarm || null
    this.next = null
    this.checkout = null

    this.updating = false
    this.updated = false
    this.applied = false

    this.ready().catch(noop)
  }

  run(entrypoint, args = [], opts = {}) {
    return new Sidecar(entrypoint, args, opts)
  }

  async _open() {
    await this.drive.ready()
    log(`this.bundles is ${this.bundled}`)
    if (true) {
      // await fs.rm(path.join(this.dir, 'upgrade'), { recursive: true, force: true })
      // await fs.mkdir(path.join(this.dir, 'upgrade'))
      log('removed bundle')
      if (!this.swarm) {
        const keyPair = await this.store.createKeyPair('pear-container')
        this.swarm = new Hyperswarm({ keyPair })
      }

      this.swarm.on('connection', (connection) => this.store.replicate(connection))
      this.swarm.join(this.drive.core.discoveryKey, { client: true, server: false })

      this._updateBackground()
      this.drive.core.on('append', () => this._updateBackground())
    }
  }

  async _close() {
    await this.drive.close()
    if (this.checkout) await this.checkout.close()
    await this.store.destroy()
    await this.swarm.destroy()
  }

  _updateBackground() {
    this._update().catch(noop)
  }

  async _update() {
    if (this.updating) return
    this.updating = true

    const length = this.drive.core.length
    const id = length + '.' + this.drive.core.fork
    const next = path.join(this.dir, 'upgrade')
    const co = this.drive.checkout(length)

    this.checkout = co

    const manifest = await co.get('/package.json')
    const version = manifest && JSON.parse(manifest).version
    log(`manifest version: ${version} ... current version: ${this.version}`)
    if (!manifest || version === this.version) {
      this.updating = false
      this.checkout = null
      await co.close()
      return
    }

    const local = new Localdrive(next)

    this.emit('updating')

    for await (const data of co.mirror(local)) {
      this.emit('updating-delta', data)
    }

    await co.close()
    await local.close()

    this.checkout = null
    this.length = length
    this.next = next

    this.updating = false
    this.updated = true
    this.emit('updated', version)

    if (this.drive.core.length > length) this._updateBackground()
  }
}

function noop() {}

const rpc = new RPC(BareKit.IPC, (req) => {})

const config = JSON.parse(Bare.argv[0])
const app = new PearRuntime(config)
app.on('updated', (version) => {
  const req = rpc.request(0)
  req.send(version)
})

app.on('updating-delta', (data) =>{
  const req = rpc.request(1)
  req.send(JSON.stringify(data))
})

function log (string){
  const req = rpc.request(2)
  req.send(string)
}
