-- ---------------------------------------------------------------------------
-- KundenRadar – Phase 1 Basisschema
-- Mehrmandantenfaehig: jeder fachliche Datensatz haengt an einer organization.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
create type organization_role as enum ('OWNER', 'ADMIN', 'MEMBER');

create type lead_status as enum (
  'NEW',
  'ANALYZED',
  'REVIEW',
  'TO_CONTACT',
  'CONTACTED',
  'REPLIED',
  'MEETING',
  'OFFER',
  'WON',
  'LOST',
  'ARCHIVED'
);

create type lead_source as enum (
  'MANUAL',
  'IMPORT',
  'REFERRAL',
  'INBOUND',
  'RESEARCH',
  'OTHER'
);

create type analysis_status as enum ('PENDING', 'SUCCESS', 'FAILED', 'BLOCKED');

create type activity_type as enum (
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'STATUS_CHANGED',
  'ANALYSIS_RUN',
  'NOTE_ADDED',
  'ARCHIVED',
  'RESTORED'
);

-- --------------------------------------------------------------------------
-- Organisationen & Mitglieder
-- --------------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Spiegel von auth.users, damit Namen ohne Zugriff auf das auth-Schema
-- angezeigt werden koennen.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            organization_role not null default 'MEMBER',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on organization_members (user_id);
create index organization_members_org_idx on organization_members (organization_id);

-- --------------------------------------------------------------------------
-- Leads
-- --------------------------------------------------------------------------
create table leads (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  company_name          text not null check (char_length(trim(company_name)) between 1 and 200),
  website_url           text,
  domain                text,
  city                  text,
  postal_code           text,
  industry              text,
  email                 text,
  phone                 text,
  contact_person        text,
  source                lead_source not null default 'MANUAL',
  status                lead_status not null default 'NEW',
  potential_score       integer check (potential_score between 0 and 100),
  has_agency            boolean not null default false,
  detected_agency_name  text,
  notes                 text,
  last_analysis_id      uuid,
  last_analyzed_at      timestamptz,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index leads_org_status_idx on leads (organization_id, status);
create index leads_org_score_idx on leads (organization_id, potential_score desc nulls last);
create index leads_org_created_idx on leads (organization_id, created_at desc);
create unique index leads_org_domain_key on leads (organization_id, domain) where domain is not null;

-- --------------------------------------------------------------------------
-- Website-Analysen
-- --------------------------------------------------------------------------
create table website_analyses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  lead_id           uuid references leads (id) on delete cascade,
  requested_url     text not null,
  final_url         text,
  domain            text,
  status            analysis_status not null default 'PENDING',
  error_message     text,
  http_status       integer,
  response_time_ms  integer,
  score             integer check (score between 0 and 100),
  findings          jsonb not null default '[]'::jsonb,
  metrics           jsonb not null default '{}'::jsonb,
  agency_hint       jsonb,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index website_analyses_org_created_idx on website_analyses (organization_id, created_at desc);
create index website_analyses_lead_idx on website_analyses (lead_id, created_at desc);

alter table leads
  add constraint leads_last_analysis_fkey
  foreign key (last_analysis_id) references website_analyses (id) on delete set null;

-- --------------------------------------------------------------------------
-- Notizen & Aktivitaeten
-- --------------------------------------------------------------------------
create table lead_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  lead_id         uuid not null references leads (id) on delete cascade,
  body            text not null check (char_length(trim(body)) between 1 and 5000),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index lead_notes_lead_idx on lead_notes (lead_id, created_at desc);

create table lead_activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  lead_id         uuid not null references leads (id) on delete cascade,
  type            activity_type not null,
  message         text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index lead_activities_lead_idx on lead_activities (lead_id, created_at desc);

-- --------------------------------------------------------------------------
-- updated_at Trigger
-- --------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------------
-- Profil automatisch beim Registrieren anlegen
-- --------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
