-- Chat history for Excelliq.
-- Run once in Supabase -> SQL Editor -> New query -> Run.
--
-- Until this table exists the app still works: it detects the missing table,
-- stops calling Supabase, and keeps history in a per-user localStorage cache.
-- After you run this, history follows the account across devices.

create table if not exists public.chats (
  id          bigint      primary key,                -- client-side Date.now() id
  user_id     uuid        not null references auth.users(id) on delete cascade,
  prompt      text        not null,
  date_label  text,                                   -- pre-formatted display date
  best        text,
  status      text        default 'Complete',
  responses   jsonb       default '{}'::jsonb,        -- { gemini, claude, openai, stage1Claude }
  follow_ups  jsonb       default '[]'::jsonb,
  token_data  jsonb,
  elapsed     numeric,
  created_at  timestamptz default now()
);

-- Sidebar lists newest-first for the current user.
create index if not exists chats_user_id_idx on public.chats (user_id, id desc);

-- Row-level security: a user can only ever touch their own rows. This makes the
-- old cross-account leak structurally impossible rather than a code convention.
alter table public.chats enable row level security;

drop policy if exists "chats_select_own" on public.chats;
create policy "chats_select_own" on public.chats
  for select using (auth.uid() = user_id);

drop policy if exists "chats_insert_own" on public.chats;
create policy "chats_insert_own" on public.chats
  for insert with check (auth.uid() = user_id);

drop policy if exists "chats_update_own" on public.chats;
create policy "chats_update_own" on public.chats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chats_delete_own" on public.chats;
create policy "chats_delete_own" on public.chats
  for delete using (auth.uid() = user_id);
