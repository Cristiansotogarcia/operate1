import fs from 'fs'
import path from 'path'

export interface WorkerConfig {
  supabase_url: string
  supabase_anon_key: string
  registration_key: string
  device_id: string | null
  api_secret: string | null
  heartbeat_interval_ms: number
  log_level: string
}

const CONFIG_PATH = path.join(__dirname, '..', 'worker.config.json')

export function loadConfig(): WorkerConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}\nCopy worker.config.json.example to worker.config.json and fill in your values.`)
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
  return JSON.parse(raw) as WorkerConfig
}

export function saveConfig(config: WorkerConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function isRegistered(config: WorkerConfig): boolean {
  return !!config.device_id && !!config.api_secret
}
