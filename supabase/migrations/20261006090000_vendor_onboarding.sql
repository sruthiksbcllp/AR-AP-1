-- Vendor onboarding master data and review workflow (P2P spec section 3).

create type public.vendor_onboarding_status as enum (
  'procurement_review',
  'finance_review',
  'compliance_check',
  'active',
  'rejected'
);

alter table public.contacts
  add column if not exists trade_name text,
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists business_registration_number text,
  add column if not exists pan text,
  add column if not exists gstin text,
  add column if not exists tax_residency_certificate text,
  add column if not exists contact_person text,
  add column if not exists bank_name text,
  add column if not exists beneficiary_name text,
  add column if not exists account_number text,
  add column if not exists ifsc_swift text,
  add column if not exists payment_terms text,
  add column if not exists credit_period_days integer,
  add column if not exists vendor_code text,
  add column if not exists vendor_status public.vendor_onboarding_status,
  add column if not exists created_by uuid references public.users (id) on delete set null;

alter table public.contacts
  drop constraint if exists contacts_credit_period_check;

alter table public.contacts
  add constraint contacts_credit_period_check
  check (credit_period_days is null or credit_period_days >= 0);

comment on column public.contacts.name is 'Vendor legal name (or customer name)';
comment on column public.contacts.trade_name is 'Trade / DBA name';
comment on column public.contacts.business_registration_number is 'Business registration number';
comment on column public.contacts.tax_residency_certificate is 'Tax residency certificate reference, when applicable';
comment on column public.contacts.vendor_code is 'Org-scoped vendor code, e.g. VND-0001';
comment on column public.contacts.vendor_status is 'Vendor onboarding status; null for customers';
comment on column public.contacts.created_by is 'User who submitted the vendor master record';

update public.contacts
set gstin = tax_id
where type = 'vendor'
  and gstin is null
  and tax_id is not null;

update public.contacts
set vendor_status = 'active'
where type = 'vendor'
  and vendor_status is null;

with numbered as (
  select
    id,
    row_number() over (partition by org_id order by created_at, id) as n
  from public.contacts
  where type = 'vendor'
    and vendor_code is null
)
update public.contacts c
set vendor_code = 'VND-' || lpad(numbered.n::text, 4, '0')
from numbered
where c.id = numbered.id;

create unique index if not exists contacts_org_vendor_code_uidx
  on public.contacts (org_id, vendor_code)
  where vendor_code is not null;

create index if not exists contacts_org_vendor_status_idx
  on public.contacts (org_id, vendor_status)
  where type = 'vendor';

alter table public.contacts
  drop constraint if exists contacts_vendor_status_by_type;

alter table public.contacts
  add constraint contacts_vendor_status_by_type
  check (
    (type = 'vendor' and vendor_status is not null and vendor_code is not null)
    or (type = 'customer' and vendor_status is null and vendor_code is null)
  );

create or replace function public.set_vendor_defaults()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if new.type = 'vendor' then
    if new.vendor_status is null then
      new.vendor_status := 'procurement_review';
    end if;
    if new.vendor_code is null or btrim(new.vendor_code) = '' then
      select coalesce(
        max(
          nullif(substring(c.vendor_code from 5), '')::integer
        ),
        0
      ) + 1
      into n
      from public.contacts c
      where c.org_id = new.org_id
        and c.vendor_code ~ '^VND-[0-9]+$';

      new.vendor_code := 'VND-'
        || case
          when n < 10000 then lpad(n::text, 4, '0')
          else n::text
        end;
    end if;
  else
    new.vendor_status := null;
    new.vendor_code := null;
  end if;

  return new;
end;
$$;

drop trigger if exists contacts_set_vendor_defaults on public.contacts;
create trigger contacts_set_vendor_defaults
before insert on public.contacts
for each row
execute function public.set_vendor_defaults();

grant execute on function public.set_vendor_defaults() to authenticated;

create or replace function public.validate_bill_vendor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.contacts c
    where c.id = new.vendor_id
      and c.org_id = new.org_id
      and c.type = 'vendor'
      and c.vendor_status = 'active'
  ) then
    raise exception 'bill vendor_id must reference an active vendor in the same organization';
  end if;

  return new;
end;
$$;

drop policy if exists "rfq_quotes_insert_same_org" on public.rfq_quotes;
create policy "rfq_quotes_insert_same_org"
  on public.rfq_quotes for insert to authenticated
  with check (
    exists (
      select 1
      from public.rfqs r
      where r.id = rfq_id
        and r.org_id = private.user_org_id()
    )
    and exists (
      select 1
      from public.contacts c
      where c.id = vendor_id
        and c.org_id = private.user_org_id()
        and c.type = 'vendor'
        and c.vendor_status = 'active'
    )
  );
