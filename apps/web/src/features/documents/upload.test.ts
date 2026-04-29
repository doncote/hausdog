import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ prisma: {} }))
vi.mock('@/lib/env', () => ({ getServerEnv: vi.fn() }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@trigger.dev/sdk/v3', () => ({
  auth: { createPublicToken: vi.fn() },
  configure: vi.fn(),
  tasks: { trigger: vi.fn() },
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn(() => ({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockReturnThis(),
  })),
}))
vi.mock('../../../trigger/process-document', () => ({}))

import { inferDocumentType } from './upload'

describe('inferDocumentType', () => {
  describe('PDF files', () => {
    it('returns manual for PDF with "manual" in filename', () => {
      expect(inferDocumentType('application/pdf', 'user_manual.pdf')).toBe('manual')
    })

    it('returns warranty for PDF with "warranty" in filename', () => {
      expect(inferDocumentType('application/pdf', 'Warranty_Card.pdf')).toBe('warranty')
    })

    it('returns receipt for PDF with "receipt" in filename', () => {
      expect(inferDocumentType('application/pdf', 'purchase_receipt.pdf')).toBe('receipt')
    })

    it('returns invoice for PDF with "invoice" in filename', () => {
      expect(inferDocumentType('application/pdf', 'Invoice_2024.pdf')).toBe('invoice')
    })

    it('returns other for generic PDF filename', () => {
      expect(inferDocumentType('application/pdf', 'document.pdf')).toBe('other')
    })

    it('is case-insensitive for keyword matching', () => {
      expect(inferDocumentType('application/pdf', 'MANUAL.pdf')).toBe('manual')
      expect(inferDocumentType('application/pdf', 'WARRANTY.pdf')).toBe('warranty')
    })
  })

  describe('image files', () => {
    it('returns photo for jpeg image', () => {
      expect(inferDocumentType('image/jpeg', 'photo.jpg')).toBe('photo')
    })

    it('returns photo for png image', () => {
      expect(inferDocumentType('image/png', 'screenshot.png')).toBe('photo')
    })

    it('returns receipt for image with "receipt" in filename', () => {
      expect(inferDocumentType('image/jpeg', 'receipt_scan.jpg')).toBe('receipt')
    })

    it('returns photo for heic image', () => {
      expect(inferDocumentType('image/heic', 'IMG_1234.heic')).toBe('photo')
    })
  })

  describe('other file types', () => {
    it('returns other for unknown content type', () => {
      expect(inferDocumentType('application/octet-stream', 'file.bin')).toBe('other')
    })

    it('returns other for text file', () => {
      expect(inferDocumentType('text/plain', 'notes.txt')).toBe('other')
    })
  })
})
