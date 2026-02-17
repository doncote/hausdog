import { OpenAPIHono } from '@hono/zod-openapi'
import { type AuthContext, apiKeyAuth } from './middleware/auth'
import { authRouter } from './routes/auth'
import { documentsRouter } from './routes/documents'
import { eventsRouter } from './routes/events'
import { itemsRouter } from './routes/items'
import { propertiesRouter } from './routes/properties'
import { spacesRouter } from './routes/spaces'

// Create the API app with typed context
export const api = new OpenAPIHono<{ Variables: AuthContext }>()

// Health check endpoint (no auth required)
api.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// OpenAPI spec endpoint (no auth required)
api.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Hausdog API',
    version: '1.0.0',
    description:
      'API for managing home documentation - properties, spaces, items, events, and documents',
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

// Apply auth middleware to all authenticated routes
api.use('/properties/*', apiKeyAuth)
api.use('/spaces/*', apiKeyAuth)
api.use('/items/*', apiKeyAuth)
api.use('/events/*', apiKeyAuth)
api.use('/documents/*', apiKeyAuth)
api.use('/auth/*', apiKeyAuth)

// Mount routers
api.route('/', propertiesRouter)
api.route('/', spacesRouter)
api.route('/', itemsRouter)
api.route('/', eventsRouter)
api.route('/', documentsRouter)
api.route('/', authRouter)

export type ApiApp = typeof api
