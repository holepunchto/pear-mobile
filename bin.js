#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const fsp = require('fs/promises')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')

const pack = require('bare-pack')
const { resolve } = require('bare-module-traverse')
const packFs = require('bare-pack/fs')
const id = require('bare-bundle-id')

const input = process.argv[2]
const base = input ? path.resolve(input) : process.cwd()
const entry = require.resolve('./lib/pear.js')

;(async () => {
  try {
    // project needs react-native-bare-kit defined in deps to work
    await ensureDeclared('react-native-bare-kit')
    await prepare(pathToFileURL(entry), pathToFileURL(base))
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()

async function prepare(entryURL, baseURL) {
  const bundle = await pack(
    entryURL,
    {
      preset: 'mobile',
      target: ['ios', 'android'],
      hosts: ['ios', 'android'],
      resolve: resolve.bare,
      linked: true
    },
    packFs.readModule,
    packFs.listPrefix
  )

  const unmounted = bundle.unmount(baseURL)
  unmounted.id = id(unmounted).toString('hex')
  const buffer = unmounted.toBuffer()
  const data = `module.exports = ${JSON.stringify(buffer.toString('utf8'))}\n`

  const file = path.join(__dirname, 'lib', 'pear.bundle.js')

  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, data)
}

async function ensureDeclared(dep) {
  const pkgPath = path.join(base, 'package.json')
  if (!fs.existsSync(pkgPath)) return

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

  const declared =
    pkg.dependencies?.[dep] || pkg.devDependencies?.[dep] || pkg.peerDependencies?.[dep]

  if (declared) return

  let cmd = 'npm'
  let args = ['install', dep, '--save']

  if (fs.existsSync(path.join(base, 'pnpm-lock.yaml'))) {
    cmd = 'pnpm'
    args = ['add', dep]
  } else if (fs.existsSync(path.join(base, 'yarn.lock'))) {
    cmd = 'yarn'
    args = ['add', dep]
  } else if (fs.existsSync(path.join(base, 'bun.lockb'))) {
    cmd = 'bun'
    args = ['add', dep]
  }

  const sp = spawn(cmd, args, {
    cwd: base,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  await new Promise((resolve) => {
    sp.once('close', resolve)
    sp.once('error', resolve)
  })
}
