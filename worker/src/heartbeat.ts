import { WorkerConfig } from './config'
import { createApi } from './api'
import { collectMetrics } from './metrics'
import { logger } from './logger'

export function startHeartbeat(config: WorkerConfig): NodeJS.Timeout {
  const api = createApi(config)
  const interval = config.heartbeat_interval_ms || 30000

  logger.info(`Starting heartbeat loop (every ${interval / 1000}s)`)

  async function beat() {
    try {
      const metrics = await collectMetrics()
      await api.call('worker-heartbeat', {
        cpu_percent: metrics.cpu,
        ram_percent: metrics.ram,
        disk_percent: metrics.disk,
        ip_address: metrics.ip,
      })
      logger.debug(`Heartbeat sent: CPU=${metrics.cpu}% RAM=${metrics.ram}% Disk=${metrics.disk}%`)
    } catch (err) {
      logger.error(`Heartbeat failed: ${err}`)
    }
  }

  // Send first heartbeat immediately
  beat()

  return setInterval(beat, interval)
}
