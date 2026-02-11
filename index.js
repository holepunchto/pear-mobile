const { Worklet } = require('react-native-bare-kit')
const RNFS = require('react-native-fs')

module.exports = class PearRuntime {
  constructor(config = {}) {
    this._listeners = Object.create(null)

    this.version = config.version || 0
    this.storage = `${RNFS.DocumentDirectoryPath}/pear-runtime/storage`
    this.key = config.key
    this.length = config.length
    this.fork = config.fork || 0
    this.link = 'pear://' + this.fork + '.' + this.length + '.' + this.key
  }

  async ready(){}
  async close(){}

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(callback)
    return this
  }

  off(event, callback) {
    if (!this._listeners[event]) return this
    if (callback) {
      this._listeners[event] = this._listeners[event].filter((fn) => fn !== callback)
    } else {
      this._listeners[event] = []
    }
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
    console.warn('PearRuntime: applyUpdate() not supported for mobile')
  }
}
