// Agent — collects metrics (battery, disk health, power state), pairs via code,
// heartbeats via edge functions, runs endpoint monitor checks.
// Light metrics (CPU/RAM/disk space) every 5s. Heavy metrics (battery/disk health) every 60s.

import fs from 'fs'
import path from 'path'
import os from 'os'
import si from 'systeminformation'
import { app, BrowserWindow } from 'electron'
import { SUPABASE_ANON_KEY, FUNCTIONS_URL } from './config'
import { startMonitoring, stopMonitoring, getActiveMonitorCount, setLogger } from './monitor-scheduler'

const CONFIG_DIR = app.getPath('userData')
const CONFIG_PATH = path.join(CONFIG_DIR, 'agent.json')

export interface AgentConfig {
  device_id: string | null
  api_secret: string | null
  heartbeat_interval_ms: number
}

export interface AgentMetrics {
  cpu_percent: number
  ram_total_gb: number
  ram_used_gb: number
  ram_percent: number
  uptime_hours: number
  hostname: string
  platform: string
  disk_total_gb: number
  disk_used_gb: number
  disk_percent: number
  disk_type: string | null
  disk_io_read_mb: number
  disk_io_write_mb: number
  smart_status: string | null
  disk_temp_c: number | null
  battery_percent: number | null
  battery_charging: boolean | null
  ac_connected: boolean | null
  power_source: 'ac' | 'battery' | 'ups' | null
  has_battery: boolean
  agent_version: string
  active_monitors: number
}

export interface AgentStatus {
  connected: boolean
  device_id: string | null
  last_heartbeat: string | null
  heartbeat_count: number
  error: string | null
}

let config: AgentConfig = { device_id: null, api_secret: null, heartbeat_interval_ms: 30000 }
let status: AgentStatus = { connected: false, device_id: null, last_heartbeat: null, heartbeat_count: 0, error: null }
let latestMetrics: AgentMetrics | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lightTimer: ReturnType<typeof setInterval> | null = null
let heavyTimer: ReturnType<typeof setInterval> | null = null
let mainWin: BrowserWindow | null = null

// Cached heavy metrics — updated every 60s, not every 5s
let cachedHeavy = {
  disk_type: null as string | null,
  disk_io_read_mb: 0,
  disk_io_write_mb: 0,
  smart_status: null as string | null,
  disk_temp_c: null as number | null,
  battery_percent: null as number | null,
  battery_charging: null as boolean | null,
  ac_connected: null as boolean | null,
  power_source: null as 'ac' | 'battery' | 'ups' | null,
  has_battery: false,
}

export function setMainWindow(win: BrowserWindow) { mainWin = win }

function send(channel: string, data: unknown) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, data)
}

// ─── Config persistence ──────────────────────────
export function loadConfig(): AgentConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch { /* use defaults */ }
  return config
}

function saveConfig() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function isPaired(): boolean {
  return !!config.device_id && !!config.api_secret
}

// ─── Pairing ────────────────────────────────────
export async function pairWithCode(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(`${FUNCTIONS_URL}/device-pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        code: code.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        hostname: os.hostname(),
        os: `${os.type()} ${os.release()}`,
        os_version: `${os.arch()}`,
      }),
    })

    const data = await resp.json() as { device_id?: string; api_secret?: string; heartbeat_interval_ms?: number; error?: string }

    if (!resp.ok) {
      return { success: false, error: data.error || `HTTP ${resp.status}` }
    }

    config.device_id = data.device_id ?? null
    config.api_secret = data.api_secret ?? null
    config.heartbeat_interval_ms = data.heartbeat_interval_ms || 30000
    saveConfig()

    status.device_id = data.device_id ?? null
    status.connected = true
    send('status-update', status)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' }
  }
}

export function unpair() {
  stopAgent()
  config = { device_id: null, api_secret: null, heartbeat_interval_ms: 30000 }
  saveConfig()
  status = { connected: false, device_id: null, last_heartbeat: null, heartbeat_count: 0, error: null }
  latestMetrics = null
  send('status-update', status)
}

// ─── Light metrics (every 5s) — fast, low CPU ───
async function collectLight(): Promise<void> {
  try {
    const [cpu, mem, disk] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ])

    const d = disk?.[0] || { size: 0, used: 0, use: 0 }

    latestMetrics = {
      cpu_percent: Math.round(cpu.currentLoad * 10) / 10,
      ram_total_gb: Math.round((mem.total / 1073741824) * 10) / 10,
      ram_used_gb: Math.round((mem.active / 1073741824) * 10) / 10,
      ram_percent: Math.round((mem.active / mem.total) * 1000) / 10,
      uptime_hours: Math.round((os.uptime() / 3600) * 10) / 10,
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      disk_total_gb: Math.round((d.size / 1073741824) * 10) / 10,
      disk_used_gb: Math.round((d.used / 1073741824) * 10) / 10,
      disk_percent: Math.round(d.use * 10) / 10,
      // Merge cached heavy metrics
      ...cachedHeavy,
      agent_version: app.getVersion(),
      active_monitors: getActiveMonitorCount(),
    }

    send('metrics-update', latestMetrics)
  } catch { /* swallow — will retry in 5s */ }
}

// ─── Heavy metrics (every 60s) — slow WMI calls ───
async function collectHeavy(): Promise<void> {
  try {
    const [diskLayout, diskIOraw, batteryRaw] = await Promise.all([
      si.diskLayout().catch(() => null),
      si.disksIO().catch(() => null),
      si.battery().catch(() => null),
    ])

    const primaryDisk = diskLayout?.[0] ?? null
    const diskIO = diskIOraw ?? { rIO_sec: 0, wIO_sec: 0 }
    const battery = batteryRaw ?? { hasBattery: false, isCharging: false, percent: 0, acConnected: true }

    // Disk type
    let diskType: string | null = null
    if (primaryDisk) {
      const iface = (primaryDisk.interfaceType || '').toLowerCase()
      const name = (primaryDisk.name || '').toLowerCase()
      if (iface.includes('nvme') || name.includes('nvme')) diskType = 'NVMe'
      else if (primaryDisk.type === 'SSD' || iface.includes('ssd') || name.includes('ssd')) diskType = 'SSD'
      else if (primaryDisk.type === 'HD') diskType = 'HDD'
      else diskType = primaryDisk.type || null
    }

    // SMART status
    let smartStatus: string | null = null
    if (primaryDisk) {
      const smart = (primaryDisk as any).smartStatus
      if (smart === 'Ok' || smart === 'OK' || smart === 'PASSED') smartStatus = 'ok'
      else if (smart) smartStatus = smart.toLowerCase().includes('fail') ? 'failing' : 'caution'
    }

    // Power source — simple logic, no chassis call
    let powerSource: 'ac' | 'battery' | 'ups' | null = null
    if (battery.hasBattery) {
      powerSource = battery.acConnected ? 'ac' : 'battery'
    } else {
      powerSource = 'ac'
    }

    const ioData = diskIO as { rIO_sec?: number; wIO_sec?: number }

    cachedHeavy = {
      disk_type: diskType,
      disk_io_read_mb: Math.round(((ioData.rIO_sec || 0) / 1048576) * 10) / 10,
      disk_io_write_mb: Math.round(((ioData.wIO_sec || 0) / 1048576) * 10) / 10,
      smart_status: smartStatus,
      disk_temp_c: primaryDisk?.temperature ?? null,
      has_battery: battery.hasBattery,
      battery_percent: battery.hasBattery ? Math.round(battery.percent) : null,
      battery_charging: battery.hasBattery ? battery.isCharging : null,
      ac_connected: battery.acConnected ?? null,
      power_source: powerSource,
    }
  } catch { /* swallow — will retry in 60s */ }
}

// ─── Public accessor for IPC ───────────────────
export async function collectMetrics(): Promise<AgentMetrics> {
  await collectLight()
  return latestMetrics!
}

// ─── Heartbeat ──────────────────────────────────
async function sendHeartbeat() {
  if (!config.device_id || !config.api_secret) return

  try {
    // Use latest cached metrics, don't re-collect
    const m = latestMetrics
    if (!m) return

    const resp = await fetch(`${FUNCTIONS_URL}/worker-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-device-id': config.device_id,
        'x-device-secret': config.api_secret,
      },
      body: JSON.stringify({
        cpu_percent: m.cpu_percent,
        ram_percent: m.ram_percent,
        disk_percent: m.disk_percent,
        battery_percent: m.battery_percent,
        battery_charging: m.battery_charging,
        ac_connected: m.ac_connected,
        power_source: m.power_source,
        disk_type: m.disk_type,
        disk_io_read_mb: m.disk_io_read_mb,
        disk_io_write_mb: m.disk_io_write_mb,
        smart_status: m.smart_status,
        disk_temp_c: m.disk_temp_c,
        agent_version: m.agent_version,
      }),
    })

    if (resp.ok) {
      status.connected = true
      status.last_heartbeat = new Date().toISOString()
      status.heartbeat_count++
      status.error = null
    } else {
      const err = await resp.json().catch(() => ({}))
      status.connected = false
      status.error = (err as any).error || `HTTP ${resp.status}`
    }
  } catch (err: any) {
    status.connected = false
    status.error = err.message || 'Network error'
  }

  send('status-update', status)
}

// ─── Shutdown tracking ─────────────────────────
export async function reportShutdown(reason: 'graceful' | 'restart' | 'update') {
  if (!config.device_id || !config.api_secret) return
  try {
    await fetch(`${FUNCTIONS_URL}/worker-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-device-id': config.device_id,
        'x-device-secret': config.api_secret,
      },
      body: JSON.stringify({
        cpu_percent: 0, ram_percent: 0, disk_percent: latestMetrics?.disk_percent ?? 0,
        shutdown_reason: reason,
      }),
    })
  } catch { /* best effort */ }
}

// ─── Start / Stop ───────────────────────────────
export function startAgent() {
  if (!isPaired()) return
  status.device_id = config.device_id

  setLogger((msg) => send('monitor-log', msg))

  // Light metrics every 5s (CPU, RAM, disk space — fast)
  collectLight()
  lightTimer = setInterval(() => collectLight(), 5000)

  // Heavy metrics every 60s (battery, disk health — slow WMI), delayed 3s
  setTimeout(() => {
    collectHeavy()
    heavyTimer = setInterval(() => collectHeavy(), 60000)
  }, 3000)

  // First heartbeat after 2s, then on interval
  setTimeout(() => sendHeartbeat(), 2000)
  heartbeatTimer = setInterval(() => sendHeartbeat(), config.heartbeat_interval_ms)

  // Monitoring scheduler starts after 10s delay
  setTimeout(() => startMonitoring(config), 10000)
}

export function stopAgent() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  if (lightTimer) { clearInterval(lightTimer); lightTimer = null }
  if (heavyTimer) { clearInterval(heavyTimer); heavyTimer = null }
  stopMonitoring()
}

export function getStatus(): AgentStatus { return status }
export function getMetrics(): AgentMetrics | null { return latestMetrics }
export function getConfig(): AgentConfig { return config }
