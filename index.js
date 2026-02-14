const { Worklet } = require('react-native-bare-kit') // NEED TO INSTALL IN ROOT PRJECT (version match)
const bundle = require('./lib/pear.bundle.js')
const RPC = require('bare-rpc')
const RNFS = require('react-native-fs')
const AsyncStorage = require('@react-native-async-storage/async-storage') // NEED TO INSTALL IN ROOT PRJECT (version match)
const { DevSettings } = require('react-native') // NEED TO INSTALL IN ROOT PRJECT (version match)
const b4a = require('b4a')

module.exports = class PearRuntime {
  constructor(config = {}) {
    if (!config.upgrade) throw new Error('upgrade link required')
    this.config = {
      dir: `${RNFS.DocumentDirectoryPath}/pear-runtime`,
      isDev: __DEV__,
      ...config
    }

    this._listeners = Object.create(null)
    this._calledReady = null

    this.IPCPromise = this.ready().catch(noop)
  }

  ready() {
    if (this._calledReady) return this._calledReady
    this._calledReady = this._open()
    return this._calledReady
  }

  async _open() {
    const runtimeDir = `${RNFS.DocumentDirectoryPath}/pear-runtime`
    const storageDir = `${runtimeDir}/storage`

    await RNFS.mkdir(runtimeDir)
    await RNFS.mkdir(storageDir)

    const argv = [JSON.stringify(this.config)]
    const worklet = new Worklet()
    worklet.start('/pear.bundle', bundle, argv)

    return new RPC(worklet.IPC, async (req) => {
      if (req.command === 0) {
        const version = b4a.toString(req.data)
        console.log('received version form pearend:', version)
        this.emit('updateReady', version)
      }
      if (req.command === 1){
        const updateData = b4a.toString(req.data)
        console.log('[Update Diff]', updateData)
      }
      if (req.command === 2){
        const logString = b4a.toString(req.data)
        console.log('[pear-runtime]:', logString)
      }
    })
  }

  async applyUpdate(version) {
    await AsyncStorage.multiSet([
      ['updatePending', 'true'],
      ['updateConfirmed', 'false'],
      ['runtimeVersion', String(version ?? this.version)]
    ])

    DevSettings.reload()
  }

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
