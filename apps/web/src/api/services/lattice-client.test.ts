import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLatticeClient } from './lattice-client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const BASE_URL = 'https://lattice.example.com'
const API_KEY = 'test-api-key'

function makeOkJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  }
}

function makeErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
  }
}

const sampleIssue = {
  id: 'issue-1',
  title: 'Fix the bug',
  status: 'in_progress',
  priority: 1,
  issue_type: 'bug',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createLatticeClient', () => {
  describe('listIssues', () => {
    it('sends Authorization Bearer header', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([sampleIssue]))

      await client.listIssues({})

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers.Authorization).toBe('Bearer test-api-key')
    })

    it('requests the correct endpoint', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({})

      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(`${BASE_URL}/v1/issues`)
    })

    it('returns array response directly', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([sampleIssue]))

      const result = await client.listIssues({})

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('issue-1')
    })

    it('returns issues from object response with issues key', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse({ issues: [sampleIssue] }))

      const result = await client.listIssues({})

      expect(result).toHaveLength(1)
      expect(result[0]?.title).toBe('Fix the bug')
    })

    it('returns empty array when object response has no issues key', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse({}))

      const result = await client.listIssues({})

      expect(result).toEqual([])
    })

    it('appends assignee filter to query string', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({ assignee: 'user-1' })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('assignee=user-1')
    })

    it('appends priority filter to query string', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({ priority: 2 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('priority=2')
    })

    it('appends limit filter to query string', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({ limit: 25 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('limit=25')
    })

    it('appends cursor filter to query string', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({ cursor: 'abc123' })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('cursor=abc123')
    })

    it('appends multiple status values', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({ status: ['in_progress', 'review'] })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('status=in_progress')
      expect(url).toContain('status=review')
    })

    it('appends multiple labels_any values', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse([]))

      await client.listIssues({ labels_any: ['bug', 'urgent'] })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('labels_any=bug')
      expect(url).toContain('labels_any=urgent')
    })

    it('throws on HTTP error', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Internal Server Error'))

      await expect(client.listIssues({})).rejects.toThrow('Lattice API error: 500')
    })
  })

  describe('getIssue', () => {
    it('requests the correct issue endpoint', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse(sampleIssue))

      await client.getIssue('issue-1')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`${BASE_URL}/v1/issues/issue-1`)
    })

    it('sends Authorization Bearer header', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse(sampleIssue))

      await client.getIssue('issue-1')

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers.Authorization).toBe('Bearer test-api-key')
    })

    it('returns the issue data', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeOkJsonResponse(sampleIssue))

      const result = await client.getIssue('issue-1')

      expect(result.id).toBe('issue-1')
      expect(result.title).toBe('Fix the bug')
      expect(result.status).toBe('in_progress')
    })

    it('throws on HTTP error', async () => {
      const client = createLatticeClient(BASE_URL, API_KEY)
      mockFetch.mockResolvedValue(makeErrorResponse(404, 'Not Found'))

      await expect(client.getIssue('nonexistent')).rejects.toThrow('Lattice API error: 404')
    })
  })
})
