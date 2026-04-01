// Endpoint monitoring checks — HTTP, ICMP (ping), TCP port

import https from 'https'
import http from 'http'
import net from 'net'
import { spawn } from 'child_process'

export interface CheckResult {
  status: 'up' | 'down'
  response_ms: number | null
  error_message: string | null
}

export async function checkHttp(target: string): Promise<CheckResult> {
  const start = Date.now()
  const mod = target.startsWith('https') ? https : http

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      resolve({ status: 'down', response_ms: null, error_message: 'timeout (10s)' })
    }, 10000)

    const req = mod.get(target, { timeout: 10000 }, (res) => {
      clearTimeout(timeout)
      // Drain body to free socket
      res.resume()
      const ms = Date.now() - start
      if (res.statusCode && res.statusCode < 500) {
        resolve({ status: 'up', response_ms: ms, error_message: null })
      } else {
        resolve({ status: 'down', response_ms: ms, error_message: `HTTP ${res.statusCode}` })
      }
    })

    req.on('error', (err) => {
      clearTimeout(timeout)
      resolve({ status: 'down', response_ms: null, error_message: err.message })
    })

    req.on('timeout', () => {
      clearTimeout(timeout)
      req.destroy()
      resolve({ status: 'down', response_ms: null, error_message: 'timeout' })
    })
  })
}

export async function checkIcmp(target: string): Promise<CheckResult> {
  const start = Date.now()
  const isWindows = process.platform === 'win32'
  const args = isWindows ? ['-n', '1', '-w', '3000', target] : ['-c', '1', '-W', '3', target]

  return new Promise(resolve => {
    const proc = spawn('ping', args)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve({ status: 'down', response_ms: null, error_message: 'timeout (5s)' })
    }, 5000)

    proc.on('close', code => {
      clearTimeout(timer)
      if (timedOut) return
      if (code === 0) {
        resolve({ status: 'up', response_ms: Date.now() - start, error_message: null })
      } else {
        resolve({ status: 'down', response_ms: null, error_message: `ping exit ${code}` })
      }
    })

    proc.on('error', err => {
      clearTimeout(timer)
      resolve({ status: 'down', response_ms: null, error_message: err.message })
    })
  })
}

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
      resolve({ status: 'down', response_ms: null, error_message: err.message })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ status: 'down', response_ms: null, error_message: 'timeout (5s)' })
    })
  })
}
