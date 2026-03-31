import si from 'systeminformation'
import os from 'os'
import { logger } from './logger'

export interface SystemMetrics {
  cpu: number
  ram: number
  disk: number
  ip: string
}

export async function collectMetrics(): Promise<SystemMetrics> {
  try {
    const [cpuLoad, mem, disk] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ])

    const cpuPercent = Math.round(cpuLoad.currentLoad * 100) / 100
    const ramPercent = Math.round((mem.used / mem.total) * 10000) / 100

    // Use the main disk (largest or first non-zero)
    let diskPercent = 0
    if (disk.length > 0) {
      const mainDisk = disk.reduce((a, b) => a.size > b.size ? a : b)
      diskPercent = Math.round(mainDisk.use * 100) / 100
    }

    const ip = getLocalIp()

    return { cpu: cpuPercent, ram: ramPercent, disk: diskPercent, ip }
  } catch (err) {
    logger.error(`Failed to collect metrics: ${err}`)
    return { cpu: 0, ram: 0, disk: 0, ip: getLocalIp() }
  }
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}
