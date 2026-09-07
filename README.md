# pear-mobile

Embeddable Pear runtime for mobile applications. Provides storage path and bare workers via worklets.

```sh
npm install pear-mobile react-native-bare-kit
```

This module integrates Pear into React-Native-based Mobile applications.

See [pear-runtime](https://github.com/holepunchto/pear-runtime) for Pear's embeddable runtime module for Desktop Devices.

## MVP - EXPERIMENTAL

This library is MVP and Experimental.

## OS Support

- Android
- iOS

## Requirements

`react-native-bare-kit` MUST be declared in the project root's `package.json` `dependencies` field. React Native's autolinking only scans the application's own dependencies, so that is what decides whether the native module is compiled into the build. A copy that arrives transitively is enough for the JavaScript `require` and not enough for the natives, which fails at runtime rather than at build time.

`react-native-bare-kit` also sets `minSdk 29` in its own Gradle config, so the application's Android minimum SDK has to be at least 29. In an Expo project that is done with `expo-build-properties`:

```sh
npx expo install expo-build-properties
```

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 29
          }
        }
      ]
    ]
  }
}
```

In a plain React Native project, raise `minSdkVersion` in `android/build.gradle` directly.

Booting an applied OTA bundle is native behavior and is not part of this module. See [pear-runtime-react-native](https://github.com/holepunchto/pear-runtime-react-native) for the Expo config plugin and Metro config that make release builds load it.

## Usage

```js
// react-native
import PearRuntime from 'pear-mobile'
import { useEffect } from 'react'
import bundle from './worker.bundle.js'

export default function App() {
  useEffect(() => {
    const IPC = PearRuntime.run('/worker.bundle', bundle, [...args])
  }, [])
}

// bare worker
const PearRuntime = require('pear-mobile')
const { version, upgrade, productName } = require('./package.json')

const runtime = new PearRuntime({ version, upgrade, name: productName })
runtime.updater.on('updated', async () => {
  await runtime.updater.applyUpdate()
  console.log('restart for update')
})
```

## Quick Starts

```sh
git clone https://github.com/holepunchto/hello-pear-react-native
```

For end-to-end instructions from building to deploying with [Pear](https://docs.pears.com) see [hello-pear-react-native](https://github.com/holepunchto/hello-pear-react-native) boilerplate.

## Features

- Peer-to-Peer Over-the-Air (P2P OTA) updates (via [pear-runtime-updater](https://www.github.com/holepunchto/pear-runtime-updater))
- Run workers in [Bare](https://github.com/holepunchto/bare) Threads
- Application storage management

## Application metadata

The runtime takes its identity from the application's `package.json`:

```json
{
  "name": "example-app",
  "productName": "ExampleApp",
  "version": "1.0.0",
  "upgrade": "pear://<real-drive-key>"
}
```

- **`upgrade`** must be a real Pear link, created with `pear touch`. It is parsed when the updater is constructed, so a placeholder value throws at construction even when `updates` is `false`. Disabling updates does not make the field optional.
- **`productName`** is what gets passed as `name`, and it must match the application directory inside every architecture payload exactly. See [Making updates](#making-updates).
- **`version`** is compared against the payload manifest version to decide whether an update applies. It must be valid [SemVer][semver], and it also has to stay in sync with the native app version that boot control compares against, see [pear-runtime-react-native](https://github.com/holepunchto/pear-runtime-react-native#version-synchronization).

## API

`pear-mobile` can be used in 2 different enviornmenets: in `react-native` to start workers and manage piping and inside a `bare` worker to manage OTA updates.

### React-Native

#### `IPC <stream.Duplex> = PearRuntime.run(specifier, bundle, args = [])`

Start a [bare](https://github.com/holepunchto/bare) worker thread.
Returns a duplex stream, the `IPC` pipe.

In the worker, `Bare.IPC` is the other end of the pipe.

> [!IMPORTANT]
> `specifier` must have the following format: `"/specifier.bundle"`

### Bare

#### `const pear = new PearRuntime(opts)`

Create a pear Object. `opts` may include:

- **`dir`** Directory to store data (e.g. app data dir). Defaults to devices standard persistant dir.
- **`upgrade`** – (required) Pear link for OTA updates (e.g. from `package.json` `upgrade` field).
- **`name`** - (required) The package.json productName of the app.
- **`store`** - (optional) pass a [Corestore](https://github.com/holepunchto/corestore) to be used for updates. If passed `swarm` must also be passed. The `store` should be replicated over the `swarm`.
- **`swarm`** - (optional) pass a [Hyperswarm](https://github.com/holepunchto/hyperswarm) to be used for swarming updates. If passed `store` must also be passed. The `store` should be replicated over the `swarm`.
- **`app`** – (optional) The path to the local OTA react-native bundle as booted from native code. (defaults to [pear-runtime-react-native](https://github.com/holepunchto/pear-runtime-react-native) default)
- **`version`** – (optional) Current app version (i.e. from `package.json`); used for update checks (defaults to `'0.0.0-0'`).
- **`updates`** – (optional) Set to `false` to disable P2P OTA updates.
- **`storage`** – (optional) Saves the app storage path.
- **`skipUpdate`** - (optional) additional skipUpdate logic

#### `pear.storage`

Suggested storage folder for app storage.

#### `pear.updater`

Instance of [pear-runtime-updater](https://www.github.com/holepunchto/pear-runtime-updater)

#### `await pear.ready()`

Awaits the open of the updater (p2p connections, drive open ...)

#### `await pear.close()`

Shut it down. You should do this when closing your app for best performance.

## Workers

Bare workers run as worklets through `react-native-bare-kit`. The worker is bundled ahead of time and imported by the app, which has two consequences:

- The bundle must exist before the first native build.
- It must be rebuilt after every change to the worker or to any of the worker's dependencies.

A stale worker bundle is not detected by anything, so it is worth wiring into a script:

```sh
npx bare-pack --host ios-arm64 --host ios-arm64-simulator --host ios-x64-simulator \
  --host android-arm64 --linked --out ./src/worker.bundle.js ./workers/main.js
```

Worker bundles are usually generated and gitignored, which means a CI or EAS checkout does not have one. Adding the bundling step to the EAS lifecycle covers that:

```json
{
  "scripts": {
    "eas-build-post-install": "npm run bundle:bare"
  }
}
```

## Making updates

VERY EXPERIMENTAL, MOST DEFINITELY WILL CHANGE.

Update listening and apply logic lives in [pear-runtime-updater](https://www.github.com/holepunchto/pear-runtime-updater).

First allocate a pear link if you haven't using [`pear`](https://github.com/holepunchto/pear):

```sh
pear touch
```

Store this link in the `package.json` `upgrade` field of a project.

### Payload layout

The updater resolves exactly one path inside the drive, and nothing else:

```
/by-arch/<platform>-<arch>/app/<productName>
```

So for `productName` `ExampleApp` a deployment folder looks like this:

```
/package.json
/pear.json
/by-arch
  /[...platform-arch]
    /app
      /ExampleApp
        /app.bundle
        /assets
```

The `<productName>` directory is mandatory. Without it the updater finds no entries under its prefix and throws `update not found`.

Root `package.json` is mandatory too. There is no update at all without a manifest version to compare, and `pear-mobile` copies that manifest in next to the installed `app.bundle` before applying, which is what the native boot control later reads.

The host is computed on the device from the Bare runtime's own platform and architecture, so a missing architecture is not a fallback situation: devices of that architecture simply find no update. A payload must therefore cover every architecture the app ships to, including the simulator hosts for anyone testing OTA in a simulator.

### Building the payload

For React Native, bundling needs a `metro.config.js` in the project root that extends `@react-native/metro-config`. In an Expo project, extend both:

```js
const { getDefaultConfig: getRNConfig, mergeConfig } = require('@react-native/metro-config')
const { getDefaultConfig: getExpoConfig } = require('expo/metro-config')

module.exports = mergeConfig(getRNConfig(__dirname), getExpoConfig(__dirname))
```

In a plain React Native project, drop the Expo half and use `getRNConfig(__dirname)` alone. Either way `@react-native/metro-config` belongs in the project devDependencies at the version matching the project React Native, together with `@react-native-community/cli`, which `npx react-native bundle` delegates to and fails without:

```sh
npm install --save-dev @react-native/metro-config @react-native-community/cli
```

> [!IMPORTANT]
> Bundle the frontend into a directory named exactly `productName`, once per platform:

```sh
npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output out/ios/ExampleApp/app.bundle --assets-dest out/ios/ExampleApp
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output out/android/ExampleApp/app.bundle --assets-dest out/android/ExampleApp
```

Then let [pear-build](https://github.com/holepunchto/pear-build) assemble the deployment folder:

```sh
npx pear-build \
  --package ./package.json \
  --config ./pear.json \
  --ios-arm64 ./out/ios/ExampleApp \
  --ios-arm64-simulator ./out/ios/ExampleApp \
  --ios-x64-simulator ./out/ios/ExampleApp \
  --android-arm64 ./out/android/ExampleApp \
  --target dist
```

`pear-build` copies `package.json` and `pear.json` into the target, mirrors each input directory under the right host, and validates the directory name against `productName`, so a mismatch fails the build instead of producing a payload the updater cannot resolve. `--config` is mandatory for mobile builds, which are detected by `react-native-bare-kit` appearing in the app's dependencies.

### Native compatibility

`pear.json` sits beside `package.json` and holds the oldest app version an OTA payload is compatible with:

```json
{
  "updates": {
    "minver": "0.0.0-0"
  }
}
```

The key is lowercase `minver`, nested under `updates`. It is not the payload version. `pear-mobile` reads it from the drive before downloading and skips the update on any client whose version is below it, emitting `minver-required`. Surfacing that to the user ("update available in the store") is the application's job, nothing is displayed by default.

Leave `minver` alone for an ordinary JS-only payload. Raise it to the version of the native release that introduced the change when a payload needs a newer native build.

### Stage and seed

Now go to the deployment folder and stage this onto the link with `pear stage`

```sh
pear stage {link-from-touch} {path-to-payload}
```

Now seed it. Any build out there on a lower version will trigger the update flow.

[semver]: https://semver.org

## LICENSE

Apache-2.0
