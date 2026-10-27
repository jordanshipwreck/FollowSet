-- Followset cloud v1: creator programs, subscriptions, synced user data, AI connector keys,
-- program suggestions from outside assistants, coach usage caps, and the media bucket.
-- Row-level security on every table: the anon/auth roles only ever see what the policies allow.
-- Edge functions use the service role and filter by user id themselves.

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  handle text unique check (handle ~ '^[a-z0-9_.]{2,30}$'),
  bio text not null default '',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- ---------- Programs (the marketplace) ----------
create table public.programs (
  id text primary key,
  creator_id uuid not null references auth.users on delete cascade,
  creator_name text not null default '',
  creator_handle text not null default '',
  title text not null check (length(title) between 1 and 80),
  summary text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0 and price_cents <= 100000),
  level text not null default 'intermediate' check (level in ('beginner', 'intermediate', 'advanced')),
  tags text[] not null default '{}',
  days jsonb not null default '{}',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_published on public.programs (published, updated_at desc);
alter table public.programs enable row level security;
-- Browsing shows every published program, including paid ones' full days: the paywall is
-- enforced in the app for now (docs/SOP.md → Known limitations: move paid days behind subscriptions before launch).
create policy "published or own programs" on public.programs for select using (published or auth.uid() = creator_id);
create policy "creators insert own" on public.programs for insert with check (auth.uid() = creator_id);
create policy "creators update own" on public.programs for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "creators delete own" on public.programs for delete using (auth.uid() = creator_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();

-- ---------- Subscriptions (written only by the payments webhook, never by clients) ----------
create table public.subscriptions (
  user_id uuid not null references auth.users on delete cascade,
  program_id text not null references public.programs on delete cascade,
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);
alter table public.subscriptions enable row level security;
create policy "see own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);

-- ---------- Synced user data (what the coach and the MCP connector read) ----------
create table public.user_data (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "own data read" on public.user_data for select using (auth.uid() = user_id);
create policy "own data insert" on public.user_data for insert with check (auth.uid() = user_id);
create policy "own data update" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data delete" on public.user_data for delete using (auth.uid() = user_id);
create trigger user_data_touch before update on public.user_data for each row execute function public.touch_updated_at();

-- ---------- AI connector keys (hash only; issued by the mcp-key function) ----------
create table public.mcp_keys (
  key_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index mcp_keys_user on public.mcp_keys (user_id);
alter table public.mcp_keys enable row level security;
-- No client policies: only the service role (edge functions) touches keys.

-- ---------- Program suggestions from outside assistants (MCP suggest_program) ----------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  program jsonb not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index suggestions_open on public.suggestions (user_id) where claimed_at is null;
alter table public.suggestions enable row level security;
create policy "own suggestions read" on public.suggestions for select using (auth.uid() = user_id);
create policy "own suggestions claim" on public.suggestions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Coach usage cap ----------
create table public.coach_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;

create or replace function public.bump_coach_usage(uid uuid) returns integer
language sql security definer set search_path = public as $$
  insert into coach_usage (user_id, day, count) values (uid, current_date, 1)
  on conflict (user_id, day) do update set count = coach_usage.count + 1
  returning count;
$$;
revoke all on function public.bump_coach_usage(uuid) from public, anon, authenticated;

-- ---------- Media bucket: creator demo videos and voice notes ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 62914560, array['video/mp4', 'video/webm', 'video/quicktime', 'audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/ogg'])
on conflict (id) do nothing;
-- Public read (programs are public); each creator writes only inside their own folder: <uid>/...
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
