// Installs the Operate1 Worker as a Windows service.
// Run as Administrator: node install-service.js
// Requires node-windows: pnpm add -D node-windows

const path = require('path')

let Service
try {
  Service = require('node-windows').Service
} catch {
  console.error('node-windows not found. Run: pnpm add -D node-windows')
  process.exit(1)
}

const scriptPath = path.join(__dirname, 'dist', 'index.js')

const svc = new Service({
  name: 'Operate1 Worker',
  description: 'Operate1 monitoring agent — sends heartbeats and runs endpoint checks',
  script: scriptPath,
  workingDirectory: __dirname,
  nodeOptions: [],
  env: [
    { name: 'NODE_ENV', value: 'production' },
  ],
})

svc.on('install', () => {
  console.log('✓ Service "Operate1 Worker" installed successfully.')
  console.log('  Starting service...')
  svc.start()
})

svc.on('start', () => {
  console.log('✓ Service started.')
  console.log('  To stop:   node uninstall-service.js')
  console.log('  To manage: services.msc → Operate1 Worker')
})

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed. To reinstall, run uninstall-service.js first.')
})

svc.on('error', (err) => {
  console.error('Service error:', err)
})

console.log('Installing Operate1 Worker as a Windows service...')
console.log(`Script: ${scriptPath}`)
console.log('Note: This requires Administrator privileges.\n')
svc.install()
