import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consoleLogger } from './console-logger'

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.LOG_LEVEL
})

describe('consoleLogger.info', () => {
  it('calls console.info with [INFO] prefix', () => {
    consoleLogger.info('hello world')
    expect(console.info).toHaveBeenCalledWith('[INFO] hello world', '')
  })

  it('includes meta object when provided', () => {
    consoleLogger.info('with meta', { userId: 'abc' })
    expect(console.info).toHaveBeenCalledWith('[INFO] with meta', { userId: 'abc' })
  })
})

describe('consoleLogger.warn', () => {
  it('calls console.warn with [WARN] prefix', () => {
    consoleLogger.warn('something fishy')
    expect(console.warn).toHaveBeenCalledWith('[WARN] something fishy', '')
  })
})

describe('consoleLogger.error', () => {
  it('calls console.error with [ERROR] prefix', () => {
    consoleLogger.error('it broke')
    expect(console.error).toHaveBeenCalledWith('[ERROR] it broke', '')
  })

  it('includes meta object when provided', () => {
    consoleLogger.error('db error', { code: 500 })
    expect(console.error).toHaveBeenCalledWith('[ERROR] db error', { code: 500 })
  })
})

describe('consoleLogger.debug', () => {
  it('does not call console.debug when LOG_LEVEL is not set', () => {
    consoleLogger.debug('debug message')
    expect(console.debug).not.toHaveBeenCalled()
  })

  it('does not call console.debug when LOG_LEVEL is "info"', () => {
    process.env.LOG_LEVEL = 'info'
    consoleLogger.debug('debug message')
    expect(console.debug).not.toHaveBeenCalled()
  })

  it('calls console.debug with [DEBUG] prefix when LOG_LEVEL is "debug"', () => {
    process.env.LOG_LEVEL = 'debug'
    consoleLogger.debug('trace this')
    expect(console.debug).toHaveBeenCalledWith('[DEBUG] trace this', '')
  })

  it('includes meta when LOG_LEVEL is "debug"', () => {
    process.env.LOG_LEVEL = 'debug'
    consoleLogger.debug('trace', { key: 'val' })
    expect(console.debug).toHaveBeenCalledWith('[DEBUG] trace', { key: 'val' })
  })
})
