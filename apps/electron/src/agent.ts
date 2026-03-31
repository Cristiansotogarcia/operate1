// Agent — collects metrics, pairs via code, heartbeats via edge functions.
// No direct Supabase client usage. All writes go through edge functions.

import fs from 'fs'
import path from 'path'
import os from 'os'
import si from 'systeminformation'
import { app, BrowserWindow } from 'electron'
import { SUPABASE_ANON_KEY, FUNCTIONS_URL } from './config'

// Config stored in %APPDATA%/Operate1/
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
  disk_total_gb: number
  disk_used_gb: number
  disk_percent: number
  uptime_hours: number
  hostname: string
  platform: string
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
let metricsTimer: ReturnType<typeof setInterval> | null = null
let mainWin: BrowserWindow | null = null

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

// ─── Metrics ────────────────────────────────────
export async function collectMetrics(): Promise<AgentMetrics> {
  const [cpu, mem, disk] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
  ])

  const d = disk[0] || { size: 0, used: 0, use: 0 }

  latestMetrics = {
    cpu_percent: Math.round(cpu.currentLoad * 10) / 10,
    ram_total_gb: Math.round((mem.total / 1073741824) * 10) / 10,
    ram_used_gb: Math.round((mem.active / 1073741824) * 10) / 10,
    ram_percent: Math.round((mem.active / mem.total) * 1000) / 10,
    disk_total_gb: Math.round((d.size / 1073741824) * 10) / 10,
    disk_used_gb: Math.round((d.used / 1073741824) * 10) / 10,
    disk_percent: Math.round(d.use * 10) / 10,
    uptime_hours: Math.round((os.uptime() / 3600) * 10) / 10,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
  }

  send('metrics-update', latestMetrics)
  return latestMetrics
}

// ─── Heartbeat ──────────────────────────────────
async function sendHeartbeat() {
  if (!config.device_id || !config.api_secret) return

  try {
    const m = await collectMetrics()

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

// ─── Start / Stop ───────────────────────────────
export function startAgent() {
  if (!isPaired()) return
  status.device_id = config.device_id

  collectMetrics()
  metricsTimer = setInterval(() => collectMetrics(), 5000)

  sendHeartbeat()
  heartbeatTimer = setInterval(() => sendHeartbeat(), config.heartbeat_interval_ms)
}

export function stopAgent() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null }
}

export function getStatus(): AgentStatus { return status }
export function getMetrics(): AgentMetrics | null { return latestMetrics }
export function getConfig(): AgentConfig { return config }
