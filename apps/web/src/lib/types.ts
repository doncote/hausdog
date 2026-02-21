/**
 * Shared constants and types for the Hausdog application.
 */

// Event types
export const EVENT_TYPES = [
  'installation',
  'maintenance',
  'repair',
  'inspection',
  'replacement',
  'observation',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

// Document types
export const DOCUMENT_TYPES = [
  'photo',
  'receipt',
  'manual',
  'warranty',
  'invoice',
  'other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

// Document processing statuses
export const DOCUMENT_STATUSES = [
  'pending',
  'processing',
  'ready_for_review',
  'confirmed',
  'discarded',
] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

// Property types
export const PROPERTY_TYPES = ['single_family', 'condo', 'townhouse', 'multi_family'] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

// Chat message roles
export const MESSAGE_ROLES = ['user', 'assistant'] as const

export type MessageRole = (typeof MESSAGE_ROLES)[number]
