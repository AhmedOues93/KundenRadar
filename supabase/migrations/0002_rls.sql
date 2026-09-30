-- ---------------------------------------------------------------------------
-- KundenRadar – Row Level Security
-- Grundregel: ein Nutzer sieht ausschliesslich Daten der Organisationen,
-- in denen er Mitglied ist.
-- ---------------------------------------------------------------------------

-- Hilfsfunktionen. SECURITY DEFINER, damit die Policies auf
-- organization_members nicht rekursiv werden.
create or replace function is_org_member(org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role in ('OWNER', 'ADMIN')
  );
$$;

revoke execute on function is_org_member(uuid) from public;
revoke execute on function is_org_admin(uuid) from public;
grant execute on function is_org_member(uuid) to authenticated;
grant execute on function is_org_admin(uuid) to authenticated;

alter table organizations        enable row level security;
alter table profiles             enable row level security;
alter table organization_members enable row level security;
alter table leads                enable row level security;
alter table website_analyses     enable row level security;
alter table lead_notes           enable row level security;
alter table lead_activities      enable row level security;

-- --------------------------------------------------------------------------
-- organizations
-- --------------------------------------------------------------------------
create policy organizations_select on organizations
  for select to authenticated
  using (is_org_member(id));

create policy organizations_update on organizations
  for update to authenticated
  using (is_org_admin(id))
  with check (is_org_admin(id));

-- --------------------------------------------------------------------------
-- profiles: eigenes Profil plus Profile von Kollegen derselben Organisation
-- --------------------------------------------------------------------------
create policy profiles_select on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from organization_members mine
      join organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = auth.uid());

-- --------------------------------------------------------------------------
-- organization_members
-- --------------------------------------------------------------------------
create policy organization_members_select on organization_members
  for select to authenticated
  using (user_id = auth.uid() or is_org_member(organization_id));

create policy organization_members_write on organization_members
  for all to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- --------------------------------------------------------------------------
-- leads / website_analyses / lead_notes: jedes Mitglied darf lesen & schreiben
-- --------------------------------------------------------------------------
create policy leads_select on leads
  for select to authenticated using (is_org_member(organization_id));
create policy leads_insert on leads
  for insert to authenticated with check (is_org_member(organization_id));
create policy leads_update on leads
  for update to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
create policy leads_delete on leads
  for delete to authenticated using (is_org_admin(organization_id));

create policy website_analyses_select on website_analyses
  for select to authenticated using (is_org_member(organization_id));
create policy website_analyses_insert on website_analyses
  for insert to authenticated with check (is_org_member(organization_id));
create policy website_analyses_update on website_analyses
  for update to authenticated
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy lead_notes_select on lead_notes
  for select to authenticated using (is_org_member(organization_id));
create policy lead_notes_insert on lead_notes
  for insert to authenticated with check (is_org_member(organization_id));
create policy lead_notes_delete on lead_notes
  for delete to authenticated
  using (created_by = auth.uid() or is_org_admin(organization_id));

-- Aktivitaeten sind ein Audit-Log: lesen und anlegen, aber nicht aendern.
create policy lead_activities_select on lead_activities
  for select to authenticated using (is_org_member(organization_id));
create policy lead_activities_insert on lead_activities
  for insert to authenticated with check (is_org_member(organization_id));
