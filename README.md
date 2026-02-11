# pear-mobile

Embeddable Pear runtime that gives you P2P OTA updates and bare workers for mobile applications

```sh
npm install pear-mobile
```

```sh
npm install react-native-bare-kit --save
```

## API

#### `const runtime = new PearRuntime(...)`

TODO

#### `worker = runtime.run(filename, bundle, argv)`

Start a bare worker. Worker is a duplex stream.
Stdio is available at worker.stdin, worker.stdout, worker.stderr.

#### `runtime.on('updating')`

Emitted when an update is in progress

#### `runtime.on('updated')`

Emitted when an update is done

#### `await runtime.close()`

Shut it down. You should do this when closing your app for best performance.

## Troubleshoot

```sh
npx pear-mobile
```

## LICENSE

Apache-2.0
