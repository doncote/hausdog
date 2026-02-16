export interface ApiKey {
  id: string
  userId: string
  name: string
  lastUsedAt: Date | null
  createdAt: Date
}

export interface CreateApiKeyInput {
  name: string
}

export interface ApiKeyWithSecret extends ApiKey {
  /** The plain-text key - only available at creation time */
  secret: string
}

export interface ValidatedApiKey {
  id: string
  userId: string
  name: string
}
