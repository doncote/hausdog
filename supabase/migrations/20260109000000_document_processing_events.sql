-- Document processing events for realtime updates
-- Stores events emitted during document processing for streaming to frontend

create table document_processing_events (
    id uuid primary key default uuid_generate_v4(),
    document_id uuid not null references documents(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    event_type text not null,  -- 'started', 'step', 'llm_chunk', 'extracted_field', 'completed', 'error'
    event_data jsonb,          -- Flexible payload based on event_type
    sequence_num serial,       -- Ordering within document
    created_at timestamptz not null default now()
);

-- Indexes for efficient queries
create index idx_processing_events_document_id on document_processing_events(document_id);
create index idx_processing_events_user_id on document_processing_events(user_id);
create index idx_processing_events_created_at on document_processing_events(created_at desc);
create index idx_processing_events_doc_seq on document_processing_events(document_id, sequence_num);

-- Row Level Security: users can only see their own events
alter table document_processing_events enable row level security;

create policy "Users can view own processing events"
    on document_processing_events for select
    using (auth.uid() = user_id);

-- Allow backend service to insert events (no auth context)
-- The backend is trusted and always sets user_id correctly
create policy "Service can insert processing events"
    on document_processing_events for insert
    with check (true);

-- Enable Supabase Realtime for this table
alter publication supabase_realtime add table document_processing_events;

-- Comment documenting event types and payloads:
--
-- Event Types:
-- - 'started': Processing began
--   event_data: { "step": "downloading" | "extracting" | "analyzing" }
--
-- - 'step': Progress update
--   event_data: { "step": "...", "progress": 0-100, "message": "..." }
--
-- - 'llm_chunk': Streaming LLM output (batched)
--   event_data: { "content": "...", "index": 0, "count": 5, "is_final": false }
--
-- - 'extracted_field': Individual field extracted
--   event_data: { "field": "manufacturer" | "model" | ..., "value": "...", "confidence": 0.95 }
--
-- - 'completed': Processing finished successfully
--   event_data: { "result": {...}, "duration_ms": 1234 }
--
-- - 'error': Processing failed
--   event_data: { "error": "...", "step": "...", "retriable": true }
