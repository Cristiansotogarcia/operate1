// Removes the Operate1 Worker Windows service.
// Run as Administrator: node uninstall-service.js

const path = require('path')

let Service
try {
  Service = require('node-windows').Service
} catch {
  console.error('node-windows not found. Run: pnpm add -D node-windows')
  process.exit(1)
}

const svc = new Service({
  name: 'Operate1 Worker',
  script: path.join(__dirname, 'dist', 'index.js'),
})

svc.on('uninstall', () => {
  console.log('✓ Service "Operate1 Worker" removed.')
})

svc.on('error', (err) => {
  console.error('Service error:', err)
})

svc.on('invalidinstallation', () => {
  console.log('Service is not currently installed.')
})

console.log('Removing Operate1 Worker service...')
svc.uninstall()
