const { Worklet } = require('react-native-bare-kit')
const bundle = require('./lib/pear.bundle.js') // needs to be build
const RPC = require('bare-rpc')
const RNFS = require('react-native-fs')

module.exports = class PearRuntime {
  constructor(config = {}) {
    config = {
      dir: `${RNFS.DocumentDirectoryPath}/pear-runtime/cores`,
      ...config
    }

    this._listeners = Object.create(null)

    const argv = [JSON.stringify(config)]
    const worklet = new Worklet()
    worklet.start('/pear.bundle', bundle, argv)

    new RPC(worklet.IPC, (req) => {
      if (req.command === 'updated') {
        this.emit('updated')
      }
    })
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(callback)
    return this
  }

  once(event, fn) {
    const wrap = (...args) => {
      this.off(event, wrap)
      fn(...args)
    }
    return this.on(event, wrap)
  }

  emit(event, ...args) {
    const list = this._listeners[event]
    if (!list) return this
    for (const fn of list) fn(...args)
    return this
  }

  run(filename, bundle, argv) {
    const worklet = new Worklet()
    worklet.start(filename, bundle, argv)
    return worklet.IPC
  }

  async applyUpdate() {
    console.error('PearRuntime: applyUpdate() not supported for mobile')
  }
}
