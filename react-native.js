const { Worklet } = require('react-native-bare-kit')

module.exports = class PearRuntime {
  static run(filename, bundle, argv) {
    const worklet = new Worklet()
    worklet.start(filename, bundle, argv)
    return worklet.IPC
  }
}
