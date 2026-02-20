# pear-mobile

Embeddable Pear runtime for mobile applications. Provides storage path and bare workers via worklets.

```sh
npm install pear-mobile
```

```sh
npm install react-native-bare-kit --save
```

Requires `react-native-bare-kit` to be listed in project dependencies.

## Usage

```js
/* React Native */
import PearRuntime from 'pear-mobile'
import bundle from './worker.bundle.js'
import { version, upgrade } from './package.json'

const runtime = new PearRuntime()
const IPC = runtime.run('/worker.bundle', bundle, [runtime.dir])

/* Bare Worklet */
const PearRuntime = require('pear-runtime')
const { version, upgrade } = require('./package.json')

const dir = Bare.argv[0]

const runtime = new PearRuntime({ version, upgrade, dir })
runtime.on('updated', () => {
  runtime.applyUpdate()
  conosle.log('restart for update')
})
```

## API

#### `const runtime = new PearRuntime(...)`

Create a runtime.

#### `runtime.storage`

Absolute path to the runtime app storage directory.

#### `runtime.on(event, callback)`

Subscribe to an event. Returns `runtime` for chaining.

#### `runtime.off(event, callback?)`

Unsubscribe: remove `callback` for `event`, or remove all listeners for `event` if `callback` is omitted. Returns `runtime`.

#### `runtime.once(event, callback)`

Subscribe to an event once; listener is removed after the first emit. Returns `runtime`.

#### `const IPC <stream.Duplex> = runtime.run(filename, bundle, argv)`

Start a bare worker (worklet). Returns an IPC duplex stream. `filename` is a virtual path, `bundle` is the worklet bundle, `argv` is an array of string arguments.

`Bare.argv` in worker to access `argv`.
`Bare.IPC` in worker to access stream.

#### `runtime.ready()`

Returns a Promise. No-op on mobile; for API compatibility.

#### `runtime.close()`

Returns a Promise. No-op on mobile; for API compatibility.

#### `runtime.applyUpdate()`

Returns a Promise. On mobile this is not supported and only logs a warning; for API compatibility.

## LICENSE

Apache-2.0
