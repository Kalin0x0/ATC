import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'

const VERSION = '0.1.0'

export function generateInstanceId(): string {
  const host = hostname().slice(0, 20).replace(/[^a-zA-Z0-9-]/g, '-')
  const short = randomUUID().slice(0, 8)
  return `${host}-${process.pid}-${short}`
}

export function getNodeVersion(): string {
  return VERSION
}

export function getHostname(): string {
  return hostname()
}

export function getPid(): number {
  return process.pid
}
