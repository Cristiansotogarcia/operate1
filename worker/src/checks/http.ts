import axios from 'axios'
import { logger } from '../logger'

export interface CheckResult {
  status: 'up' | 'down'
  response_ms: number | null
  error_message: string | null
}

export async function checkHttp(target: string): Promise<CheckResult> {
  const start = Date.now()
  try {
    await axios.get(target, { timeout: 10000, validateStatus: (s) => s < 500 })
    return { status: 'up', response_ms: Date.now() - start, error_message: null }
  } catch (err: any) {
    logger.debug(`HTTP check failed for ${target}: ${err.message}`)
    return { status: 'down', response_ms: null, error_message: err.message }
  }
}
