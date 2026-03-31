import net from 'net'
import { logger } from '../logger'
import type { CheckResult } from './http'

export async function checkTcp(target: string, port: number): Promise<CheckResult> {
  const start = Date.now()

  return new Promise(resolve => {
    const socket = new net.Socket()
    socket.setTimeout(5000)

    socket.connect(port, target, () => {
      socket.destroy()
      resolve({ status: 'up', response_ms: Date.now() - start, error_message: null })
    })

    socket.on('error', (err) => {
      socket.destroy()
      logger.debug(`TCP check failed for ${target}:${port}: ${err.message}`)
      resolve({ status: 'down', response_ms: null, error_message: err.message })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ status: 'down', response_ms: null, error_message: 'timeout' })
    })
  })
}
