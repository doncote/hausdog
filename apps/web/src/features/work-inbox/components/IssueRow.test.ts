import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { relativeTime } from './IssueRow'

const NOW = new Date('2026-04-28T12:00:00Z').getTime()

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function msAgo(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

describe('relativeTime', () => {
  it('shows minutes for times less than 60 minutes ago', () => {
    expect(relativeTime(msAgo(30 * 60_000))).toBe('30m ago')
  })

  it('shows 0m ago for very recent times', () => {
    expect(relativeTime(msAgo(0))).toBe('0m ago')
  })

  it('shows 59m ago at the boundary just before hours', () => {
    expect(relativeTime(msAgo(59 * 60_000))).toBe('59m ago')
  })

  it('shows hours for times between 1 and 24 hours ago', () => {
    expect(relativeTime(msAgo(3 * 60 * 60_000))).toBe('3h ago')
  })

  it('shows 1h ago at the 60-minute boundary', () => {
    expect(relativeTime(msAgo(60 * 60_000))).toBe('1h ago')
  })

  it('shows 23h ago just before the days boundary', () => {
    expect(relativeTime(msAgo(23 * 60 * 60_000))).toBe('23h ago')
  })

  it('shows days for times between 1 and 29 days ago', () => {
    expect(relativeTime(msAgo(5 * 24 * 60 * 60_000))).toBe('5d ago')
  })

  it('shows 1d ago at the 24-hour boundary', () => {
    expect(relativeTime(msAgo(24 * 60 * 60_000))).toBe('1d ago')
  })

  it('shows 29d ago just before the date format boundary', () => {
    expect(relativeTime(msAgo(29 * 24 * 60 * 60_000))).toBe('29d ago')
  })

  it('returns locale date string for times 30+ days ago', () => {
    const dateStr = msAgo(30 * 24 * 60 * 60_000)
    const result = relativeTime(dateStr)
    expect(result).toBe(new Date(dateStr).toLocaleDateString())
  })

  it('returns locale date string for very old dates', () => {
    const dateStr = '2020-01-01T00:00:00Z'
    const result = relativeTime(dateStr)
    expect(result).toBe(new Date(dateStr).toLocaleDateString())
  })
})
