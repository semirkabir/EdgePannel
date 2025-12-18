/**
 * Centralized logging utility
 * Provides structured logging with levels and optional error tracking integration
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private logLevel: LogLevel
  private errorTracker?: (error: Error, context?: LogContext) => void

  constructor() {
    // Set log level from environment (default: 'info' in production, 'debug' in development)
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) ||
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  }

  /**
   * Set error tracking function (e.g., Sentry)
   */
  setErrorTracker(tracker: (error: Error, context?: LogContext) => void) {
    this.errorTracker = tracker
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevel = levels.indexOf(this.logLevel)
    const messageLevel = levels.indexOf(level)
    return messageLevel >= currentLevel
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (this.shouldLog('error')) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      console.error(this.formatMessage('error', message, context), errorObj)

      // Send to error tracking service if configured
      if (this.errorTracker) {
        this.errorTracker(errorObj, context)
      }
    }
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, userId?: string, context?: LogContext) {
    this.debug(`API Request: ${method} ${path}`, {
      userId: userId ? userId.substring(0, 8) + '...' : undefined,
      ...context,
    })
  }

  /**
   * Log API response
   */
  logResponse(method: string, path: string, status: number, duration?: number, context?: LogContext) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this[level](`API Response: ${method} ${path} - ${status}`, {
      duration: duration ? `${duration}ms` : undefined,
      ...context,
    })
  }
}

// Export singleton instance
export const logger = new Logger()

// Initialize error tracking if available (e.g., Sentry)
if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
  // Server-side error tracking
  try {
    // Standard dynamic import, but we wrap it to ensure it doesn't crash the build if resolution is tricky
    import('@sentry/nextjs').then((Sentry) => {
      if (Sentry && Sentry.captureException) {
        logger.setErrorTracker((error, context) => {
          Sentry.captureException(error, { extra: context })
        })
        logger.info('Error tracking initialized (Sentry)')
      }
    }).catch(() => {
      // Sentry not installed or failed to load, that's okay
    })
  } catch {
    // Ignore
  }
}

