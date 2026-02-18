/**
 * Logger interface that both winston and console loggers implement.
 * Use this for service dependencies to avoid bundling winston.
 */
export interface Logger {
  debug: (message: string, meta?: object) => void
  info: (message: string, meta?: object) => void
  warn: (message: string, meta?: object) => void
  error: (message: string, meta?: object) => void
}

/**
 * Simple console-based logger for server functions.
 * Avoids winston/readable-stream issues with Bun bundling.
 */
export const consoleLogger: Logger = {
  debug: (message: string, meta?: object) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] ${message}`, meta ?? '')
    }
  },
  info: (message: string, meta?: object) => {
    console.info(`[INFO] ${message}`, meta ?? '')
  },
  warn: (message: string, meta?: object) => {
    console.warn(`[WARN] ${message}`, meta ?? '')
  },
  error: (message: string, meta?: object) => {
    console.error(`[ERROR] ${message}`, meta ?? '')
  },
}
