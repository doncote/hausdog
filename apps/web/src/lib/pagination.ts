export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  pages: number
  hasMore: boolean
}

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

export function parsePaginationParams(raw: {
  page?: string | number
  limit?: string | number
}): PaginationParams {
  const page = Math.max(1, parseInt(String(raw.page ?? '1'), 10) || 1)
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(raw.limit ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  )
  return { page, limit }
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const pages = Math.ceil(total / limit)
  return {
    data,
    total,
    page,
    limit,
    pages,
    hasMore: page < pages,
  }
}
