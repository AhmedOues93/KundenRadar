-- ---------------------------------------------------------------------------
-- Onboarding ohne Service-Role-Key.
-- Ein eingeloggter Nutzer ohne Organisation kann sich genau eine
-- Organisation anlegen und wird dabei automatisch OWNER.
-- ---------------------------------------------------------------------------

create or replace function create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id   uuid;
  base     text;
  candidate text;
  suffix   integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;

  if org_name is null or char_length(trim(org_name)) = 0 then
    raise exception 'Name der Organisation fehlt';
  end if;

  -- Slug aus dem Namen ableiten und bei Kollision hochzaehlen.
  base := regexp_replace(lower(trim(org_name)), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if char_length(base) = 0 then
    base := 'org';
  end if;
  base := left(base, 40);

  candidate := base;
  while exists (select 1 from organizations o where o.slug = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  end loop;

  insert into organizations (name, slug)
  values (left(trim(org_name), 120), candidate)
  returning id into new_id;

  insert into organization_members (organization_id, user_id, role)
  values (new_id, auth.uid(), 'OWNER');

  insert into profiles (id, email)
  select auth.uid(), u.email from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;

  return new_id;
end;
$$;

revoke execute on function create_organization(text) from public;
grant execute on function create_organization(text) to authenticated;
