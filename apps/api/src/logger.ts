import pino from 'pino'
import { config } from './config.js'

export const logger = pino({
  level: config.log.level,
  ...(config.log.format === 'pretty'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
  base: { service: 'atc-api' },
})

export type Logger = typeof logger
