-- ---------------------------------------------------------------------------
-- Team- und Einladungsverwaltung
--
-- Bisher konnten Mitglieder nur direkt in der Datenbank angelegt werden. Diese
-- Migration ergänzt Einladungen per Link sowie das Ändern von Rollen und das
-- Entfernen von Mitgliedern – jeweils abgesichert über RLS und zusätzlich über
-- einen Schutz, der die letzte Inhaberin nicht verlieren lässt.
-- ---------------------------------------------------------------------------

create type invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

create table organization_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  /** Kleingeschrieben gespeichert, damit der Abgleich eindeutig bleibt. */
  email            text not null check (position('@' in email) > 1),
  role             organization_role not null default 'MEMBER',
  /**
   * Nur der SHA-256-Hash des Tokens wird gespeichert. Wer die Datenbank liest,
   * kann daraus keinen gültigen Einladungslink bauen.
   */
  token_hash       text not null unique,
  expires_at       timestamptz not null,
  invited_by       uuid references auth.users (id) on delete set null,
  accepted_by      uuid references auth.users (id) on delete set null,
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index organization_invitations_org_idx
  on organization_invitations (organization_id, created_at desc);

-- Pro Organisation nur eine offene Einladung je Adresse.
create unique index organization_invitations_open_email_key
  on organization_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table organization_invitations enable row level security;

-- Nur Administratoren sehen und verwalten Einladungen. Eingeladene greifen
-- ausschliesslich über die Funktionen weiter unten zu.
create policy organization_invitations_select on organization_invitations
  for select to authenticated using (is_org_admin(organization_id));
create policy organization_invitations_insert on organization_invitations
  for insert to authenticated with check (is_org_admin(organization_id));
create policy organization_invitations_update on organization_invitations
  for update to authenticated
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- --------------------------------------------------------------------------
-- Schutz: die letzte Inhaberin darf nicht verschwinden
-- --------------------------------------------------------------------------
create or replace function guard_last_owner()
returns trigger
language plpgsql
as $$
declare
  verbleibende integer;
begin
  -- Nur relevant, wenn eine OWNER-Rolle wegfällt.
  if tg_op = 'DELETE' then
    if old.role <> 'OWNER' then return old; end if;
  else
    if old.role <> 'OWNER' or new.role = 'OWNER' then return new; end if;
  end if;

  select count(*) into verbleibende
  from organization_members m
  where m.organization_id = old.organization_id
    and m.role = 'OWNER'
    and m.id <> old.id;

  if verbleibende = 0 then
    raise exception 'Die letzte Inhaberin einer Organisation kann nicht entfernt oder herabgestuft werden'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger organization_members_guard_last_owner
  before update or delete on organization_members
  for each row execute function guard_last_owner();

-- --------------------------------------------------------------------------
-- Einladung ansehen (vor der Annahme)
--
-- SECURITY DEFINER, weil die eingeladene Person noch kein Mitglied ist und die
-- Tabelle deshalb nicht lesen darf. Zurückgegeben wird nur, was die
-- Annahmeseite anzeigen muss – nie der Token oder andere Einladungen.
-- --------------------------------------------------------------------------
create or replace function invitation_preview(invite_token text)
returns table (
  organization_name text,
  email             text,
  role              organization_role,
  expires_at        timestamptz,
  status            invitation_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  hash text;
begin
  if invite_token is null or char_length(invite_token) < 20 then
    return;
  end if;
  hash := encode(digest(invite_token, 'sha256'), 'hex');

  return query
  select o.name,
         i.email,
         i.role,
         i.expires_at,
         case
           when i.revoked_at is not null then 'REVOKED'::invitation_status
           when i.accepted_at is not null then 'ACCEPTED'::invitation_status
           when i.expires_at < now() then 'EXPIRED'::invitation_status
           else 'PENDING'::invitation_status
         end
  from organization_invitations i
  join organizations o on o.id = i.organization_id
  where i.token_hash = hash;
end;
$$;

-- --------------------------------------------------------------------------
-- Einladung annehmen
--
-- Prüft Token, Ablauf, Rücknahme und ob die E-Mail des angemeldeten Kontos zur
-- Einladung passt. Erst danach entsteht die Mitgliedschaft.
-- --------------------------------------------------------------------------
create or replace function accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  einladung organization_invitations%rowtype;
  hash        text;
  konto_mail  text;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;
  if invite_token is null or char_length(invite_token) < 20 then
    raise exception 'Ungültiger Einladungslink';
  end if;

  hash := encode(digest(invite_token, 'sha256'), 'hex');

  select * into einladung from organization_invitations where token_hash = hash;
  if not found then
    raise exception 'Ungültiger Einladungslink';
  end if;
  if einladung.revoked_at is not null then
    raise exception 'Diese Einladung wurde zurückgezogen';
  end if;
  if einladung.accepted_at is not null then
    raise exception 'Diese Einladung wurde bereits angenommen';
  end if;
  if einladung.expires_at < now() then
    raise exception 'Diese Einladung ist abgelaufen';
  end if;

  select u.email into konto_mail from auth.users u where u.id = auth.uid();
  if lower(coalesce(konto_mail, '')) <> lower(einladung.email) then
    raise exception 'Diese Einladung gilt für %, angemeldet ist aber ein anderes Konto', einladung.email;
  end if;

  insert into organization_members (organization_id, user_id, role)
  values (einladung.organization_id, auth.uid(), einladung.role)
  on conflict (organization_id, user_id) do nothing;

  insert into profiles (id, email)
  values (auth.uid(), konto_mail)
  on conflict (id) do nothing;

  update organization_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = einladung.id;

  return einladung.organization_id;
end;
$$;

revoke execute on function invitation_preview(text) from public;
revoke execute on function accept_invitation(text) from public;
grant execute on function invitation_preview(text) to authenticated;
grant execute on function accept_invitation(text) to authenticated;

-- `digest` stammt aus pgcrypto, das in 0001 bereits aktiviert wird.
