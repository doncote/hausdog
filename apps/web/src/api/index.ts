import { OpenAPIHono } from '@hono/zod-openapi'
import { apiKeyAuth, type AuthContext } from './middleware/auth'

// Create the API app with typed context
export const api = new OpenAPIHono<{ Variables: AuthContext }>()

// Health check endpoint (no auth required)
api.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Apply auth middleware to all routes under /
api.use('/*', apiKeyAuth)

// OpenAPI spec endpoint
api.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Hausdog API',
    version: '1.0.0',
    description: 'API for managing home documentation - properties, spaces, items, events, and documents',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  security: [{ bearerAuth: [] }],
})

// Register security scheme
api.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'API key with hd_ prefix',
})

export type ApiApp = typeof api
