import os from 'os'
import { WorkerConfig, saveConfig } from './config'
import { createApi } from './api'
import { logger } from './logger'

export async function register(config: WorkerConfig): Promise<WorkerConfig> {
  logger.info('Starting device registration...')
  const api = createApi(config)

  const result = await api.call('worker-register', {
    registration_key: config.registration_key,
    computer_name: os.hostname(),
    os: `${os.platform()} ${os.release()}`,
    ip_address: getLocalIp(),
  })

  if (!result.device_id || !result.api_secret) {
    throw new Error('Registration failed: missing device_id or api_secret in response')
  }

  config.device_id = result.device_id
  config.api_secret = result.api_secret
  saveConfig(config)

  logger.info(`Registration successful. Device ID: ${config.device_id}`)
  return config
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}
