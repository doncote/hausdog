# CPO Tacit Knowledge

Last updated: 2026-03-07

## About This Project

- **Product**: Hausdog - home documentation management app ("The Carfax for Your Home")
- **Mission**: Help homeowners track property systems, appliances, maintenance history
- **Stack**: TanStack Start (React 19), TypeScript, PostgreSQL/Supabase, Prisma, shadcn/ui

## Product State (as of 2026-03-07)

### Stable Features
- Full CRUD for all entities (properties, spaces, items, categories, events)
- Gemini AI document extraction + address lookup + property enrichment
- Document review workflow
- Maintenance scheduling with AI suggestions
- Claude chat assistant (property context-aware)
- REST API with OpenAPI docs
- Supabase Auth

### In Progress
- Trigger.dev background jobs
- Email ingest
- Push notifications
- API key management

### Key DB Models (11)
Property, Space, Item (hierarchical), Category, Event, MaintenanceTask, Document, Conversation, Message, DeviceToken, ApiKey

### Routes (26 total)
Dashboard, Properties, Spaces, Inventory (search/filter), Documents, Maintenance, Chat, Settings, REST API (/api/v1/*)

### Feature Modules (12)
Properties, Items/Inventory, Spaces, Events, Documents, Maintenance, Categories, Chat/Assistant, Dashboard, API Keys, Notifications, REST API

### AI Integrations
- Google Gemini: document extraction, address lookup, property enrichment
- Claude AI: property assistant chat
- Trigger.dev v4: background processing

## Team
- CEO: ca32f943-3950-4c9d-84b1-458ce880cbb6 (my manager, chain of command)
- Founding Engineer: created HAU-10 (capabilities assessment)

## Operating Patterns
- AGENT_HOME = /Users/don/code/hausdog/agents/cpo
- Memory files live in AGENT_HOME/memory/
- Plans live at project root /Users/don/code/hausdog/plans/ (when created)
