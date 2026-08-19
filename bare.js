const PearRuntimeUpdater = require('pear-runtime-updater')
const ReadyResource = require('ready-resource')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const semver = require('bare-semver')
const { platform, arch } = require('which-runtime')
const path = require('bare-path')
const dir = require('bare-storage')
const fs = require('bare-fs')
const host = platform + '-' + arch

module.exports = class PearRuntime extends ReadyResource {
  constructor(opts = {}) {
    super()
    if ((!opts.store && opts.swarm) || (opts.store && !opts.swarm)) {
      throw new Error('must pass store if passing swarm and vice versa')
    }
    if (!opts.dir) opts.dir = dir.persistent()
    this.opts = opts
    if (!opts.store) opts.store = new Corestore(path.join(opts.dir, 'pear-runtime/corestore'))
    this.store = opts.store

    this.swarm = opts.swarm || null
    this.bootstrap = opts.bootstrap
    this.dir = opts.dir
    this.storage = opts.storage || path.join(this.dir, 'app-storage')
    this.skipUpdate = opts.skipUpdate || null

    const appPath = opts.app || path.join(opts.dir, 'pear-runtime', 'ota')
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true, force: true })
    this.updater = new PearRuntimeUpdater({
      ...opts,
      app: appPath,
      skipUpdate: this._skipUpdate.bind(this)
    })
    this.updater.on('updated', () => this._writeManifest())

    this.ready().catch(noop)
  }

  async _open() {
    await this.updater.ready()
    if (this.swarm === null) {
      const keyPair = await this.store.createKeyPair('pear-runtime')
      this.swarm = new Hyperswarm({ keyPair, bootstrap: this.bootstrap })
      this.swarm.on('connection', (connection) => this.store.replicate(connection))
      this.swarm.join(this.updater.drive.core.discoveryKey, {
        client: true,
        server: false
      })
    }
  }

  async _close() {
    if (this.opts.swarm) await this.swarm.destroy()
    await this.updater.close()
    if (this.opts.store) await this.store.close()
  }

  async _skipUpdate() {
    if (this.skipUpdate && (await this.skipUpdate())) return true
    await this.updater.drive.update()
    const buffer = await this.updater.drive.get('/pear.json')
    const minver = buffer && JSON.parse(buffer).updates?.minver
    if (!minver) return false
    const current = semver.Version.parse(this.updater.version)
    const skip = current.compare(semver.Version.parse(minver)) < 0
    if (skip) this.emit('minver-required', { minver, version: this.updater.version })
    return skip
  }

  async _writeManifest() {
    const co = this.updater.drive.checkout(this.updater.length)
    const buffer = await co.get('/package.json')
    if (!buffer) return
    fs.writeFileSync(
      path.join(this.updater.next, 'by-arch', host, 'app', this.updater.name, 'package.json'),
      buffer
    )
    await co.close()
  }
}

function noop() {}
