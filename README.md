# pear-mobile

Embeddable Pear runtime for mobile applications. Provides storage path and bare workers via worklets.

```sh
npm install pear-mobile
```

This module integrates Pear into React-Native-based Mobile applications.

See [pear-runtime](https://github.com/holepunchto/pear-runtime) for Pear's embeddable runtime module for Desktop Devices.

## Usage

```js
const PearRuntime = require('pear-mobile')
const { version, upgrade } = require('./package.json')

const dir = Bare.argv[0] // pass the /Documents storage dir

const runtime = new PearRuntime({ version, upgrade, dir })
runtime.on('updated', async () => {
  await runtime.applyUpdate()
  conosle.log('restart for update')
})
```

## Quick Starts

### Expo

```sh
git clone https://github.com/holepunchto/hello-pear-react-native
```

For end-to-end instructions from building to deploying with [Pear](https://docs.pears.com) see [hello-pear-react-native](https://github.com/holepunchto/hello-pear-react-native) `README.md`.

## Features

- Peer-to-Peer Over-the-Air (P2P OTA) updates (via [pear-runtime-updater](https://www.github.com/holepunchto/pear-runtime-updater))
- Application storage management

## API

Inherits from [pear-runtime-updater]{https://www.github.com/holepunchto/pear-runtime-updater}

#### `const runtime = new PearRuntime(opts)`

Create a runtime. `opts` may include:

- **`dir`** (required) – Base directory for runtime data and app storage.
- **`version`** – Current app version (e.g. from `package.json`); used for update checks.
- **`upgrade`** – Pear link for OTA updates (e.g. from `package.json` `upgrade` field).
- **`app`** – Path to the native boot bundle override; required for `applyUpdate()` to swap in the new build. Defaults to `path/to/Documents/pear-runtime/upgrades`
- **`updates`** – Set to `false` to disable P2P OTA updates.
- **`storage`** – Saves the app storage path.

#### `runtime.storage`

Suggested storage folder for app storage.

#### `await runtime.close()`

Shut it down. You should do this when closing your app for best performance.

## Making updates

VERY EXPERIMENTAL, MOST DEFINITELY WILL CHANGE.

Update listening and apply logic lives in [pear-runtime-updater](https://www.github.com/holepunchto/pear-runtime-updater).

First allocate a pear link if you haven't using [`pear`](https://github.com/holepunchto/pear):

```sh
pear touch
```

Store this link in the `package.json` `upgrade` field of a project. See [example](./example/package.json).

bundle your JS frontend. Take the distributable (e.g react-native bundle and assets) produced and make a deployment folder with the following structure:

```
/package.json
/by-arch
  /[...platform-arch]
    /app
```

Now go to this folder and stage this onto the link with `pear stage`

```sh
pear stage {link-from-touch}
```

Now seed it. Any build out there on a lower version will trigger the update flow.

## LICENSE

Apache-2.0
