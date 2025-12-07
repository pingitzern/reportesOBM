-- Create a table for the AI to store learned knowledge
create table if not exists ai_learning_base (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  context_tag text not null, -- e.g., 'client:123', 'equipment:SN-001', 'general'
  knowledge_snippet text not null, -- The learned rule or fact
  source text default 'user_correction', -- 'user_correction', 'system_inference', etc.
  confidence_score float default 1.0
);

-- Add a comment to the table
comment on table ai_learning_base is 'Stores persistent knowledge learned by the AI assistant regarding report preferences and equipment specifics.';

-- Create an index for faster context lookups
create index if not exists ai_learning_base_context_idx on ai_learning_base (context_tag);

-- Enable Row Level Security (RLS)
alter table ai_learning_base enable row level security;

-- Policy: Allow authenticated users to read all knowledge (or filter by organization if needed)
-- For now, we allow authenticated access.
create policy "Enable read access for authenticated users"
  on ai_learning_base for select
  to authenticated
  using (true);

-- Policy: Allow authenticated users to insert new knowledge
create policy "Enable insert for authenticated users"
  on ai_learning_base for insert
  to authenticated
  with check (true);
