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
  mode text not null default 'api',
  enabled_models text[] not null default array['openai', 'claude', 'gemini'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_client_id_idx on public.profiles(client_id);

alter table public.profiles enable row level security;
alter table public.client_preferences enable row level security;
