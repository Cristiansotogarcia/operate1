// Monitor scheduler — fetches assigned monitors from Supabase, runs checks, reports results

import { SUPABASE_ANON_KEY, FUNCTIONS_URL } from './config'
import { checkHttp, checkIcmp, checkTcp } from './checks'
import type { AgentConfig } from './agent'

interface MonitorDef {
  id: string
  name: string
  type: 'http' | 'icmp' | 'tcp'
  target: string
  port: number | null
  interval_seconds: number
}

const activeTimers: Map<string, ReturnType<typeof setInterval>> = new Map()
let pollTimer: ReturnType<typeof setInterval> | null = null
let logFn: (msg: string) => void = console.log

export function setLogger(fn: (msg: string) => void) { logFn = fn }

export function startMonitoring(config: AgentConfig): void {
  if (!config.device_id || !config.api_secret) return

  // First fetch after 5s, then poll every 60s — non-blocking
  setTimeout(() => {
    fetchAndSchedule(config)
    pollTimer = setInterval(() => fetchAndSchedule(config), 60000)
  }, 5000)
}

export function stopMonitoring(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  for (const [, timer] of activeTimers) clearInterval(timer)
  activeTimers.clear()
}

async function fetchAndSchedule(config: AgentConfig): Promise<void> {
  try {
    const resp = await fetch(`${FUNCTIONS_URL}/worker-monitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-device-id': config.device_id!,
        'x-device-secret': config.api_secret!,
      },
      body: JSON.stringify({}),
    })

    if (!resp.ok) {
      logFn(`[monitors] Failed to fetch monitors: HTTP ${resp.status}`)
      return
    }

    const { monitors } = await resp.json() as { monitors: MonitorDef[] }
    logFn(`[monitors] Fetched ${monitors.length} monitor(s)`)

    // Stop removed monitors
    for (const [id, timer] of activeTimers) {
      if (!monitors.find(m => m.id === id)) {
        clearInterval(timer)
        activeTimers.delete(id)
        logFn(`[monitors] Stopped: ${id}`)
      }
    }

    // Start new monitors
    for (const monitor of monitors) {
      if (activeTimers.has(monitor.id)) continue
      scheduleMonitor(monitor, config)
    }
  } catch (err: any) {
    logFn(`[monitors] Error fetching monitors: ${err.message}`)
  }
}

function scheduleMonitor(monitor: MonitorDef, config: AgentConfig): void {
  const intervalMs = (monitor.interval_seconds || 60) * 1000

  async function runCheck() {
    let result
    switch (monitor.type) {
      case 'http':  result = await checkHttp(monitor.target); break
      case 'icmp':  result = await checkIcmp(monitor.target); break
      case 'tcp':   result = await checkTcp(monitor.target, monitor.port || 80); break
      default: return
    }

    logFn(`[monitors] ${monitor.name} (${monitor.type}) ${monitor.target} → ${result.status} ${result.response_ms ?? '?'}ms`)

    // Report result to Supabase
    try {
      await fetch(`${FUNCTIONS_URL}/worker-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-device-id': config.device_id!,
          'x-device-secret': config.api_secret!,
        },
        body: JSON.stringify({
          monitor_id: monitor.id,
          status: result.status,
          response_ms: result.response_ms,
          error_message: result.error_message,
        }),
      })
    } catch (err: any) {
      logFn(`[monitors] Failed to report ${monitor.name}: ${err.message}`)
    }
  }

  // Run first check immediately, then on interval
  runCheck()
  const timer = setInterval(runCheck, intervalMs)
  activeTimers.set(monitor.id, timer)
  logFn(`[monitors] Scheduled: ${monitor.name} (${monitor.type} every ${monitor.interval_seconds}s)`)
}

export function getActiveMonitorCount(): number {
  return activeTimers.size
}
