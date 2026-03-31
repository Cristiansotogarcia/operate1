import { spawn } from 'child_process'
import { logger } from '../logger'
import type { CheckResult } from './http'

export async function checkIcmp(target: string): Promise<CheckResult> {
  const start = Date.now()
  const isWindows = process.platform === 'win32'
  const args = isWindows ? ['-n', '1', '-w', '3000', target] : ['-c', '1', '-W', '3', target]

  return new Promise(resolve => {
    const proc = spawn('ping', args)
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve({ status: 'down', response_ms: null, error_message: 'timeout' })
    }, 5000)

    proc.on('close', code => {
      clearTimeout(timeout)
      if (timedOut) return
      if (code === 0) {
        resolve({ status: 'up', response_ms: Date.now() - start, error_message: null })
      } else {
        logger.debug(`ICMP check failed for ${target} (exit code ${code})`)
        resolve({ status: 'down', response_ms: null, error_message: `ping exit code ${code}` })
      }
    })

    proc.on('error', err => {
      clearTimeout(timeout)
      resolve({ status: 'down', response_ms: null, error_message: err.message })
    })
  })
}
