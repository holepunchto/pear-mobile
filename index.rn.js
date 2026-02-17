const { Worklet } = require('react-native-bare-kit') // NEED TO INSTALL IN ROOT PRJECT (version match)
const RNFS = require('react-native-fs')

module.exports = class PearRuntime {
  constructor() {
    this.dir = RNFS.DocumentDirectoryPath

    this._listeners = Object.create(null)
    this._calledReady = null

    this.ready().catch(noop)
  }

  ready() {
    if (this._calledReady) return this._calledReady
    this._calledReady = this._open()
    return this._calledReady
  }

  async _open() {}

  async close() {}

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(callback)
    return this
  }

  off(event, callback) {
    if (!this._listeners[event]) return this
    if (callback) {
      this._listeners[event] =
        this._listeners[event].filter(fn => fn !== callback)
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
}

function noop() {}
