import { WorkerConfig } from './config'
import { createApi } from './api'
import { checkHttp } from './checks/http'
import { checkIcmp } from './checks/icmp'
import { checkTcp } from './checks/tcp'
import { logger } from './logger'

interface MonitorDef {
  id: string
  name: string
  type: 'http' | 'icmp' | 'tcp'
  target: string
  port: number | null
  interval_seconds: number
}

const activeTimers: Map<string, NodeJS.Timeout> = new Map()

export async function startScheduler(config: WorkerConfig): Promise<void> {
  const api = createApi(config)

  async function fetchAndSchedule() {
    try {
      const { monitors } = await api.call('worker-monitors', {}) as { monitors: MonitorDef[] }
      logger.info(`Fetched ${monitors.length} monitor(s) to run`)

      // Stop timers for monitors that no longer exist
      for (const [id, timer] of activeTimers) {
        if (!monitors.find(m => m.id === id)) {
          clearInterval(timer)
          activeTimers.delete(id)
          logger.info(`Stopped monitor: ${id}`)
        }
      }

      // Start new monitors
      for (const monitor of monitors) {
        if (activeTimers.has(monitor.id)) continue
        scheduleMonitor(monitor, api, config)
      }
    } catch (err) {
      logger.error(`Failed to fetch monitors: ${err}`)
    }
  }

  // Fetch monitors on startup and then every 60s to pick up changes
  await fetchAndSchedule()
  setInterval(fetchAndSchedule, 60000)
}

function scheduleMonitor(monitor: MonitorDef, api: ReturnType<typeof createApi>, config: WorkerConfig) {
  const intervalMs = (monitor.interval_seconds || 60) * 1000

  async function runCheck() {
    let result
    switch (monitor.type) {
      case 'http':
        result = await checkHttp(monitor.target)
        break
      case 'icmp':
        result = await checkIcmp(monitor.target)
        break
      case 'tcp':
        result = await checkTcp(monitor.target, monitor.port || 80)
        break
      default:
        logger.warn(`Unknown monitor type: ${monitor.type}`)
        return
    }

    logger.info(`[${monitor.name}] ${monitor.type.toUpperCase()} ${monitor.target} => ${result.status} (${result.response_ms ?? '?'}ms)`)

    try {
      await api.call('worker-results', {
        monitor_id: monitor.id,
        status: result.status,
        response_ms: result.response_ms,
        error_message: result.error_message,
      })
    } catch (err) {
      logger.error(`Failed to report result for ${monitor.name}: ${err}`)
    }
  }

  // Run first check immediately
  runCheck()
  const timer = setInterval(runCheck, intervalMs)
  activeTimers.set(monitor.id, timer)
  logger.info(`Scheduled monitor: ${monitor.name} (${monitor.type} every ${monitor.interval_seconds}s)`)
}

export function stopScheduler(): void {
  for (const [id, timer] of activeTimers) {
    clearInterval(timer)
  }
  activeTimers.clear()
}
