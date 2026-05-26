create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null unique,
  name text,
  email text unique,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mode text not null default 'browser',
  enabled_models text[] not null default array['openai', 'claude', 'gemini'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_llm_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  provider text not null check (provider in ('openai', 'claude', 'gemini')),
  profile_key text,
  status text not null default 'expired' check (status in ('connected', 'expired', 'error')),
  error text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists profiles_client_id_idx on public.profiles(client_id);
create index if not exists client_llm_sessions_client_provider_idx on public.client_llm_sessions(client_id, provider);

alter table public.profiles enable row level security;
alter table public.client_preferences enable row level security;
alter table public.client_llm_sessions enable row level security;
