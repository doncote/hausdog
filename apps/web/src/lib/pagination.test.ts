import { describe, expect, it } from 'vitest'
import { buildPaginatedResult, parsePaginationParams } from './pagination'

describe('parsePaginationParams', () => {
  it('defaults to page 1 and limit 50 when no params', () => {
    const result = parsePaginationParams({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(50)
  })

  it('parses numeric page and limit', () => {
    const result = parsePaginationParams({ page: 3, limit: 25 })
    expect(result.page).toBe(3)
    expect(result.limit).toBe(25)
  })

  it('parses string page and limit (query param format)', () => {
    const result = parsePaginationParams({ page: '2', limit: '10' })
    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
  })

  it('clamps page to minimum 1 when 0 is given', () => {
    const result = parsePaginationParams({ page: 0 })
    expect(result.page).toBe(1)
  })

  it('clamps page to minimum 1 for negative values', () => {
    const result = parsePaginationParams({ page: -5 })
    expect(result.page).toBe(1)
  })

  it('clamps limit to maximum 100', () => {
    const result = parsePaginationParams({ limit: 500 })
    expect(result.limit).toBe(100)
  })

  it('falls back to default limit when 0 is given (treated as invalid)', () => {
    // 0 is falsy, so || DEFAULT_PAGE_SIZE kicks in → 50
    const result = parsePaginationParams({ limit: 0 })
    expect(result.limit).toBe(50)
  })

  it('falls back to defaults for invalid string inputs', () => {
    const result = parsePaginationParams({ page: 'abc', limit: 'xyz' })
    expect(result.page).toBe(1)
    expect(result.limit).toBe(50)
  })

  it('falls back to page 1 for NaN page', () => {
    const result = parsePaginationParams({ page: NaN })
    expect(result.page).toBe(1)
  })
})

describe('buildPaginatedResult', () => {
  it('calculates pages as ceil(total / limit)', () => {
    const result = buildPaginatedResult([], 25, 1, 10)
    expect(result.pages).toBe(3)
  })

  it('sets hasMore true when not on last page', () => {
    const result = buildPaginatedResult(['a', 'b'], 20, 1, 10)
    expect(result.hasMore).toBe(true)
  })

  it('sets hasMore false on last page', () => {
    const result = buildPaginatedResult(['a'], 11, 2, 10)
    expect(result.hasMore).toBe(false)
  })

  it('sets hasMore false when total is 0', () => {
    const result = buildPaginatedResult([], 0, 1, 10)
    expect(result.hasMore).toBe(false)
    expect(result.pages).toBe(0)
  })

  it('sets hasMore false when all results fit on one page', () => {
    const result = buildPaginatedResult([1, 2, 3], 3, 1, 10)
    expect(result.hasMore).toBe(false)
    expect(result.pages).toBe(1)
  })

  it('passes through data, total, page, limit', () => {
    const data = [{ id: 1 }, { id: 2 }]
    const result = buildPaginatedResult(data, 100, 3, 20)
    expect(result.data).toBe(data)
    expect(result.total).toBe(100)
    expect(result.page).toBe(3)
    expect(result.limit).toBe(20)
  })

  it('handles exact page boundary (total divisible by limit)', () => {
    const result = buildPaginatedResult([], 20, 2, 10)
    // 20 / 10 = 2 pages, page 2 is last page
    expect(result.pages).toBe(2)
    expect(result.hasMore).toBe(false)
  })
})
