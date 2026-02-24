const PearRuntimeUpdater = require('pear-runtime-updater')
const ReadyResouce = require('ready-resource')
const path = require('bare-path')
const dir = require('bare-storage')

module.exports = class PearRuntime extends ReadyResouce {
  constructor(opts = {}) {
    super()
    opts.name = opts.name || opts.app
    if (!opts.name) throw new Error('need to pass name or app')
    if (!opts.dir) opts.dir = dir.persistent()

    this.dir = opts.dir
    this.storage = opts.storage || path.join(this.dir, 'app-storage')

    const appPath = path.join(opts.dir, 'pear-runtime', 'upgrade')
    this.updater = new PearRuntimeUpdater({ ...opts, app: appPath })
  }

  async _open() {
    await this.updater.ready()
  }

  async _close() {
    await this.updater.close()
  }
}
