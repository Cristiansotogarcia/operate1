import { loadConfig, isRegistered } from './config'
import { register } from './registration'
import { startHeartbeat } from './heartbeat'
import { startScheduler, stopScheduler } from './scheduler'
import { logger } from './logger'
import fs from 'fs'
import path from 'path'

// Ensure logs directory exists
const logDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

async function main() {
  logger.info('=== Operate1 Worker Agent starting ===')

  let config = loadConfig()
  logger.info(`Supabase URL: ${config.supabase_url}`)

  // Step 1: Register if not already registered
  if (!isRegistered(config)) {
    logger.info('Device not registered. Starting registration...')
    try {
      config = await register(config)
    } catch (err) {
      logger.error(`Registration failed: ${err}`)
      process.exit(1)
    }
  } else {
    logger.info(`Already registered as device: ${config.device_id}`)
  }

  // Step 2: Start heartbeat loop
  const heartbeatTimer = startHeartbeat(config)

  // Step 3: Start monitor scheduler
  await startScheduler(config)

  logger.info('Worker agent is running. Press Ctrl+C to stop.')

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...')
    clearInterval(heartbeatTimer)
    stopScheduler()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...')
    clearInterval(heartbeatTimer)
    stopScheduler()
    process.exit(0)
  })
}

main().catch(err => {
  logger.error(`Fatal error: ${err}`)
  process.exit(1)
})
