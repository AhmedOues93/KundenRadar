-- ---------------------------------------------------------------------------
-- KundenRadar – Phase 2: automatische Lead-Suche (Discovery)
--
-- Erweitert das bestehende Schema, ohne es umzubauen:
--   * lead_discovery_runs       – eine durchgeführte Suche mit ihren Parametern
--   * lead_discovery_candidates – Treffer einer Suche, vor dem Import
--   * lead_source_metadata      – Herkunftsdaten eines importierten Leads
-- ---------------------------------------------------------------------------

-- Leads, die aus einer Discovery-Suche stammen, brauchen einen eigenen Wert.
alter type lead_source add value if not exists 'DISCOVERY';

-- Strasse und Koordinaten kommen aus der Datenquelle und helfen beim
-- Duplikatabgleich über Name + Adresse.
alter table leads add column if not exists street text;
alter table leads add column if not exists country text;
alter table leads add column if not exists latitude double precision;
alter table leads add column if not exists longitude double precision;

create type discovery_run_status as enum ('PENDING', 'SUCCESS', 'FAILED');

/**
 * Warum ein Treffer nicht neu ist. Die Unterscheidung bleibt sichtbar, damit
 * der Benutzer nachvollziehen kann, weshalb eine Firma übersprungen wurde.
 */
create type candidate_match_status as enum (
  'NEW',
  'DUPLICATE_DOMAIN',
  'DUPLICATE_NAME_ADDRESS',
  'DUPLICATE_IN_RESULT'
);

-- --------------------------------------------------------------------------
-- Suchläufe
-- --------------------------------------------------------------------------
create table lead_discovery_runs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  provider          text not null,
  status            discovery_run_status not null default 'PENDING',
  -- Suchparameter, wie der Benutzer sie eingegeben hat.
  city              text not null,
  radius_km         integer not null check (radius_km between 1 and 50),
  industry          text not null,
  industry_label    text,
  max_results       integer not null check (max_results between 1 and 200),
  -- Vom Geocoder aufgelöster Ort.
  resolved_place    text,
  center_lat        double precision,
  center_lon        double precision,
  result_count      integer not null default 0,
  new_count         integer not null default 0,
  duplicate_count   integer not null default 0,
  imported_count    integer not null default 0,
  error_message     text,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  finished_at       timestamptz
);

create index lead_discovery_runs_org_created_idx
  on lead_discovery_runs (organization_id, created_at desc);

-- --------------------------------------------------------------------------
-- Treffer einer Suche. Bewusst getrennt von `leads`: erst nach der Auswahl
-- des Benutzers entsteht daraus ein Lead.
-- --------------------------------------------------------------------------
create table lead_discovery_candidates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  discovery_run_id  uuid not null references lead_discovery_runs (id) on delete cascade,
  provider          text not null,
  external_id       text not null,
  company_name      text not null,
  industry          text,
  street            text,
  postal_code       text,
  city              text,
  country           text,
  website_url       text,
  domain            text,
  phone             text,
  email             text,
  latitude          double precision,
  longitude         double precision,
  source_url        text,
  raw               jsonb not null default '{}'::jsonb,
  match_status      candidate_match_status not null default 'NEW',
  /** Bereits vorhandener Lead, auf den dieser Treffer verweist. */
  existing_lead_id  uuid references leads (id) on delete set null,
  /** Beim Import erzeugter Lead. */
  imported_lead_id  uuid references leads (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (discovery_run_id, provider, external_id)
);

create index lead_discovery_candidates_run_idx
  on lead_discovery_candidates (discovery_run_id, match_status);
create index lead_discovery_candidates_org_idx
  on lead_discovery_candidates (organization_id);

-- --------------------------------------------------------------------------
-- Herkunft eines importierten Leads. Ein Lead kann pro Datenquelle genau
-- einen Herkunftseintrag haben; der externe Schlüssel ist je Organisation
-- und Quelle eindeutig und verhindert einen zweiten Import derselben Firma.
-- --------------------------------------------------------------------------
create table lead_source_metadata (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations (id) on delete cascade,
  lead_id           uuid not null references leads (id) on delete cascade,
  provider          text not null,
  external_id       text not null,
  source_url        text,
  payload           jsonb not null default '{}'::jsonb,
  discovery_run_id  uuid references lead_discovery_runs (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);

create index lead_source_metadata_lead_idx on lead_source_metadata (lead_id);

-- --------------------------------------------------------------------------
-- Row Level Security – gleiche Regeln wie für die übrigen fachlichen Tabellen.
-- --------------------------------------------------------------------------
alter table lead_discovery_runs       enable row level security;
alter table lead_discovery_candidates enable row level security;
alter table lead_source_metadata      enable row level security;

create policy lead_discovery_runs_select on lead_discovery_runs
  for select to authenticated using (is_org_member(organization_id));
create policy lead_discovery_runs_insert on lead_discovery_runs
  for insert to authenticated with check (is_org_member(organization_id));
create policy lead_discovery_runs_update on lead_discovery_runs
  for update to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
create policy lead_discovery_runs_delete on lead_discovery_runs
  for delete to authenticated using (is_org_admin(organization_id));

create policy lead_discovery_candidates_select on lead_discovery_candidates
  for select to authenticated using (is_org_member(organization_id));
create policy lead_discovery_candidates_insert on lead_discovery_candidates
  for insert to authenticated with check (is_org_member(organization_id));
create policy lead_discovery_candidates_update on lead_discovery_candidates
  for update to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy lead_source_metadata_select on lead_source_metadata
  for select to authenticated using (is_org_member(organization_id));
create policy lead_source_metadata_insert on lead_source_metadata
  for insert to authenticated with check (is_org_member(organization_id));
