-- Company memberships: many users per company, role per company.
-- Active company stays on public.users.org_id for existing org-scoped RLS.

alter table public.users
  alter column org_id drop not null;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id);
create index if not exists organization_memberships_org_idx
  on public.organization_memberships (org_id);

alter table public.organization_memberships enable row level security;

grant select, insert, update, delete on public.organization_memberships to authenticated;

-- Shared company for current accounts (the org that already has P2P demo data)
insert into public.organization_memberships (user_id, org_id, role)
select u.id, '31519e44-8bb4-442d-983a-5395544cc336'::uuid, u.role
from public.users u
on conflict (user_id, org_id) do nothing;

create or replace function private.user_is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.user_id = auth.uid()
      and m.org_id = target_org_id
      and m.role = 'admin'
  );
$$;

revoke all on function private.user_is_org_admin(uuid) from public;
grant execute on function private.user_is_org_admin(uuid) to authenticated, service_role;

drop policy if exists "organizations_select_own" on public.organizations;
create policy "organizations_select_member"
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "organizations_insert_authenticated" on public.organizations;

drop policy if exists "users_select_same_org" on public.users;
create policy "users_select_self_or_comember"
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships mine
      join public.organization_memberships theirs
        on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid()
        and theirs.user_id = users.id
    )
  );

drop policy if exists "users_insert_same_org_or_self" on public.users;
create policy "users_insert_self"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "users_update_same_org" on public.users;
create policy "users_update_self"
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      org_id is null
      or exists (
        select 1
        from public.organization_memberships m
        where m.user_id = auth.uid()
          and m.org_id = users.org_id
      )
    )
  );

create policy "memberships_select_own_or_admin"
  on public.organization_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or private.user_is_org_admin(org_id)
  );

create or replace function public.create_company(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_has_membership boolean;
  v_is_admin boolean;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Company name is required';
  end if;
  if not exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Create an account profile first';
  end if;

  select exists (
    select 1 from public.organization_memberships m where m.user_id = v_uid
  ) into v_has_membership;
  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = v_uid and m.role = 'admin'
  ) into v_is_admin;

  if v_has_membership and not v_is_admin then
    raise exception 'Only a company admin can create another company';
  end if;

  insert into public.organizations (name, base_currency)
  values (trim(p_name), 'INR')
  returning id into v_org;

  insert into public.organization_memberships (user_id, org_id, role)
  values (v_uid, v_org, 'admin');

  update public.users
  set org_id = coalesce(org_id, v_org), role = 'admin'
  where id = v_uid;

  return v_org;
end;
$$;

create or replace function public.add_company_member(p_org_id uuid, p_email text, p_role public.user_role)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if not private.user_is_org_admin(p_org_id) then
    raise exception 'Only a company admin can add members';
  end if;

  select u.id into v_member
  from public.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_member is null then
    raise exception 'No account exists for that email. Ask them to sign up first.';
  end if;

  insert into public.organization_memberships (user_id, org_id, role)
  values (v_member, p_org_id, p_role)
  on conflict (user_id, org_id) do update set role = excluded.role;

  return v_member;
end;
$$;

create or replace function public.remove_company_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin_count int;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if not private.user_is_org_admin(p_org_id) then
    raise exception 'Only a company admin can remove members';
  end if;

  select count(*) into v_admin_count
  from public.organization_memberships
  where org_id = p_org_id and role = 'admin';

  if exists (
    select 1 from public.organization_memberships
    where org_id = p_org_id and user_id = p_user_id and role = 'admin'
  ) and v_admin_count <= 1 then
    raise exception 'Keep at least one admin on the company';
  end if;

  delete from public.organization_memberships
  where org_id = p_org_id and user_id = p_user_id;

  update public.users
  set org_id = null
  where id = p_user_id and org_id = p_org_id;
end;
$$;

revoke all on function public.create_company(text) from public;
revoke all on function public.add_company_member(uuid, text, public.user_role) from public;
revoke all on function public.remove_company_member(uuid, uuid) from public;
grant execute on function public.create_company(text) to authenticated;
grant execute on function public.add_company_member(uuid, text, public.user_role) to authenticated;
grant execute on function public.remove_company_member(uuid, uuid) to authenticated;
