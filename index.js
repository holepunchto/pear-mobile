/* global BareKit */

const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const path = require('bare-path')
const fs = require('bare-fs')
const ReadyResource = require('ready-resource')
const plink = require('pear-link')
const hid = require('hypercore-id-encoding')
const Localdrive = require('localdrive')

module.exports = class PearRuntime extends ReadyResource {
  constructor(config) {
    super()
    if (!config.dir) throw new Error('PearRuntime needs "dir" to /Documents Sandbox')
    const { drive: upgrade } = plink.parse(config.upgrade)
    this.dir = config.dir
    this.version = config.version || 0
    this.app = config.app
    this.name = config.name
    this.key = hid.decode(upgrade.key)
    this.length = upgrade.length || 0
    this.fork = upgrade.fork || 0
    this.link = plink.serialize({ drive: { fork: this.fork, length: this.length, key: this.key }})
    this.store = config.store || new Corestore(path.join(this.dir, 'corestore'))
    this.drive = new Hyperdrive(this.store, this.key)
    this.swarm = config.swarm || null
    this.next = null
    this.checkout = null

    this.updating = false
    this.updated = false

    this.ready().catch(noop)
  }

  async _open() {
    await this.drive.ready()
    await fs.mkdir(path.join(this.dir, 'pear-runtime', 'upgrade'), { recursive: true, force: true })
    if (!this.swarm) {
      const keyPair = await this.store.createKeyPair('pear-container')
      this.swarm = new Hyperswarm({ keyPair })
    }

    this.swarm.on('connection', (connection) => this.store.replicate(connection))
    this.swarm.join(this.drive.core.discoveryKey, { client: true, server: false })

    this._updateBackground()
    this.drive.core.on('append', () => this._updateBackground())
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
    const next = path.join(this.dir, 'pear-runtime', 'upgrade')
    const co = this.drive.checkout(length)

    this.checkout = co

    const manifest = await co.get('/package.json')
    const version = manifest && JSON.parse(manifest).version
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