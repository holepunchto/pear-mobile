const PearRuntimeUpdater = require('pear-runtime-updater')
const path = require('bare-path')
const fs = require('bare-fs')
const dir = require('bare-storage')

module.exports = class PearRuntime extends PearRuntimeUpdater {
  constructor(opts = {}) {
    if (!opts.dir) opts.dir = dir.persistent()
    const appPath = opts.app || path.join(opts.dir, 'pear-runtime', 'upgrade')
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true, force: true })
    if (fs.existsSync(path.join(appPath, 'package.json'))) {
      const manifest = fs.readFileSync(path.join(appPath, 'package.json'))
      opts.version = JSON.parse(manifest).version
    }
    opts = { app: appPath, ...opts }
    super(opts)
    this.storage = opts.storage || path.join(this.dir, 'app-storage')
  }
}
