import { describe, expect, it } from 'vitest'
import { CreateConversationSchema, CreateMessageSchema } from './types'

const PROPERTY_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const CONVERSATION_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'

describe('CreateConversationSchema', () => {
  it('accepts valid propertyId', () => {
    const result = CreateConversationSchema.safeParse({ propertyId: PROPERTY_ID })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID propertyId', () => {
    const result = CreateConversationSchema.safeParse({ propertyId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing propertyId', () => {
    const result = CreateConversationSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts optional title', () => {
    const result = CreateConversationSchema.safeParse({
      propertyId: PROPERTY_ID,
      title: 'Kitchen renovation questions',
    })
    expect(result.success).toBe(true)
  })

  it('accepts without title', () => {
    const result = CreateConversationSchema.safeParse({ propertyId: PROPERTY_ID })
    expect(result.success).toBe(true)
  })
})

describe('CreateMessageSchema', () => {
  const base = {
    conversationId: CONVERSATION_ID,
    role: 'user',
    content: 'What is the warranty on my HVAC?',
  }

  it('accepts valid message', () => {
    expect(CreateMessageSchema.safeParse(base).success).toBe(true)
  })

  it('rejects non-UUID conversationId', () => {
    const result = CreateMessageSchema.safeParse({ ...base, conversationId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing conversationId', () => {
    const result = CreateMessageSchema.safeParse({ role: 'user', content: 'Hello' })
    expect(result.success).toBe(false)
  })

  it('rejects empty content', () => {
    const result = CreateMessageSchema.safeParse({ ...base, content: '' })
    expect(result.success).toBe(false)
  })

  it('accepts assistant role', () => {
    const result = CreateMessageSchema.safeParse({ ...base, role: 'assistant' })
    expect(result.success).toBe(true)
  })
})
