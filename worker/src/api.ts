import axios, { AxiosError } from 'axios'
import { WorkerConfig } from './config'
import { logger } from './logger'
import { enqueue, getPending, markFlushed, incrementAttempts, getPendingCount } from './buffer'

export function createApi(config: WorkerConfig) {
  const baseURL = `${config.supabase_url}/functions/v1`

  async function call(functionName: string, body: Record<string, unknown>, retries = 3): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.supabase_anon_key}`,
    }
    if (config.device_id) headers['x-device-id'] = config.device_id
    if (config.api_secret) headers['x-device-secret'] = config.api_secret

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await axios.post(`${baseURL}/${functionName}`, body, { headers, timeout: 15000 })
        // On success, try to flush any buffered items
        flushBuffer(headers).catch(() => {})
        return res.data
      } catch (err) {
        const axErr = err as AxiosError
        const status = axErr.response?.status
        if (status === 401) {
          logger.error(`Unauthorized (401) calling ${functionName}. Re-registration may be required.`)
          throw err
        }
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000
          logger.warn(`Call to ${functionName} failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`)
          await sleep(delay)
        } else {
          logger.error(`Call to ${functionName} failed after ${retries} attempts — buffering for later`)
          enqueue(functionName, 'POST', body)
          throw err
        }
      }
    }
  }

  async function flushBuffer(headers: Record<string, string>) {
    const pending = getPending()
    if (pending.length === 0) return
    logger.info(`[buffer] Flushing ${pending.length} buffered item(s)...`)
    for (const item of pending) {
      try {
        await axios.post(`${baseURL}/${item.endpoint}`, JSON.parse(item.body), { headers, timeout: 15000 })
        markFlushed(item.id)
        logger.info(`[buffer] Flushed item ${item.id} (${item.endpoint})`)
      } catch {
        incrementAttempts(item.id)
        logger.warn(`[buffer] Failed to flush item ${item.id} — will retry later`)
        break // Stop flushing on first failure to avoid cascade
      }
    }
    const remaining = getPendingCount()
    if (remaining > 0) logger.warn(`[buffer] ${remaining} item(s) still pending`)
  }

  return { call }
}

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }
