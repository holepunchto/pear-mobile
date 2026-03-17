const PearRuntimeUpdater = require('pear-runtime-updater')
const ReadyResource = require('ready-resource')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const path = require('bare-path')
const dir = require('bare-storage')
const fs = require('bare-fs')

module.exports = class PearRuntime extends ReadyResource {
  constructor(opts = {}) {
    super()
    if ((!opts.store && !!opts.swarm) || (!!opts.store && !opts.swarm)) {
      throw new Error('must pass store if passing swarm and vice versa')
    }
    if (!opts.dir) opts.dir = dir.persistent()
    this.isModuleStore = !opts.store
    if (!opts.store) opts.store = new Corestore(path.join(opts.dir, 'pear-runtime/corestore'))

    this.swarm = opts.swarm || null
    this.isModuleSwarm = this.swarm === null
    this.bootstrap = opts.bootstrap
    this.dir = opts.dir
    this.storage = opts.storage || path.join(this.dir, 'app-storage')

    const appPath = opts.app || path.join(opts.dir, 'pear-runtime', 'ota')
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true, force: true })
    this.updater = new PearRuntimeUpdater({ ...opts, app: appPath })
    this.updater.on('error', (err) => this.emit('error', err))
  }

  async _open() {
    await this.updater.ready()
    if (this.swarm === null) {
      const keyPair = await this.updater.store.createKeyPair('pear-runtime')
      this.swarm = new Hyperswarm({ keyPair, bootstrap: this.bootstrap })
      this.swarm.on('connection', (connection) => this.updater.store.replicate(connection))
      this.swarm.join(this.updater.drive.core.discoveryKey, {
        client: true,
        server: false
      })
    }
  }

  async _close() {
    if (this.isModuleSwarm) await this.swarm.destroy()
    await this.updater.close()
    if (this.isModuleStore) await this.updater.store.close()
  }
}
