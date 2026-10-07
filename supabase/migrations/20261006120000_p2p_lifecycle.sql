-- P2P lifecycle: catalog, PR, PO, GRN, SES, three-way match, payment proposals.

alter table public.journals drop constraint if exists journals_source_check;
alter table public.journals
  add constraint journals_source_check
  check (source = any (array['manual'::text, 'ap_bill'::text, 'ar_invoice'::text, 'ar_payment'::text, 'ap_payment'::text]));

create or replace function public.post_journal(
  p_posting_date date,
  p_description text,
  p_source text,
  p_source_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_existing uuid;
  v_journal uuid;
  v_number text;
  v_line jsonb;
  v_account uuid;
  v_debit numeric(18, 2);
  v_credit numeric(18, 2);
  v_debit_sum numeric(18, 2) := 0;
  v_credit_sum numeric(18, 2) := 0;
  v_description text;
  v_line_description text;
  v_count integer := 0;
begin
  v_org := private.user_org_id();
  if v_org is null then
    raise exception 'Sign in to an organization before posting a journal';
  end if;

  v_description := btrim(coalesce(p_description, ''));
  if char_length(v_description) < 3 or char_length(v_description) > 200 then
    raise exception 'Journal description must be between 3 and 200 characters';
  end if;

  if p_posting_date is null then
    raise exception 'Posting date is required';
  end if;

  if p_source not in ('manual', 'ap_bill', 'ar_invoice', 'ar_payment', 'ap_payment') then
    raise exception 'Unknown journal source';
  end if;

  if p_source = 'manual' and p_source_id is not null then
    raise exception 'A manual journal cannot reference another document';
  end if;

  if p_source <> 'manual' and p_source_id is null then
    raise exception 'This journal must reference its source document';
  end if;

  if p_source <> 'manual' then
    select j.id into v_existing
    from public.journals j
    where j.org_id = v_org
      and j.source = p_source
      and j.source_id = p_source_id
      and j.status = 'posted';

    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal needs at least two lines';
  end if;

  v_number := 'JE-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS')
    || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);

  insert into public.journals (
    org_id, journal_number, posting_date, description, source, source_id, status, created_by
  ) values (
    v_org, v_number, p_posting_date, v_description, p_source, p_source_id, 'draft', auth.uid()
  )
  returning id into v_journal;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_account := nullif(v_line->>'account_id', '')::uuid;
    v_debit := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    v_line_description := btrim(coalesce(v_line->>'description', v_description));

    if v_account is null then
      raise exception 'Each journal line needs an account';
    end if;

    if not exists (
      select 1 from public.accounts a
      where a.id = v_account and a.org_id = v_org and a.is_group = false and a.is_active = true
    ) then
      raise exception 'Journal lines can only post to an active account in your organization';
    end if;

    if v_debit < 0 or v_credit < 0 or (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'Each journal line must be either a debit or a credit';
    end if;

    insert into public.journal_lines (journal_id, account_id, description, debit, credit)
    values (v_journal, v_account, left(v_line_description, 200), v_debit, v_credit);

    v_debit_sum := v_debit_sum + v_debit;
    v_credit_sum := v_credit_sum + v_credit;
    v_count := v_count + 1;
  end loop;

  if v_count < 2 then
    raise exception 'A journal needs at least two lines';
  end if;

  if v_debit_sum <> v_credit_sum or v_debit_sum <= 0 then
    raise exception 'Journal is out of balance. Debits % must equal credits %', v_debit_sum, v_credit_sum;
  end if;

  update public.journals set status = 'posted' where id = v_journal and status = 'draft';
  if not found then
    raise exception 'Journal could not be posted';
  end if;

  return v_journal;
end;
$$;

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  category text not null default 'general',
  item_kind text not null default 'goods' check (item_kind in ('goods', 'service')),
  unit text not null default 'each',
  standard_cost numeric(18, 2) not null default 0 check (standard_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, sku)
);

create index catalog_items_org_category_idx on public.catalog_items (org_id, category);
create index catalog_items_org_name_idx on public.catalog_items (org_id, name);

create table public.purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pr_number text not null,
  department text not null,
  cost_center text not null,
  requester_id uuid references public.users (id) on delete set null,
  need_by_date date,
  business_justification text not null,
  estimated_cost numeric(18, 2) not null default 0 check (estimated_cost >= 0),
  status text not null default 'pending_manager'
    check (status in ('draft', 'pending_manager', 'approved', 'rejected', 'in_procurement', 'ordered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, pr_number)
);

create table public.pr_lines (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  item_id uuid references public.catalog_items (id) on delete restrict,
  description text not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  estimated_unit_cost numeric(18, 2) not null default 0 check (estimated_unit_cost >= 0),
  line_total numeric(18, 2) not null default 0 check (line_total >= 0)
);

create index purchase_requisitions_org_idx on public.purchase_requisitions (org_id, created_at desc);
create index pr_lines_pr_id_idx on public.pr_lines (pr_id);

alter table public.rfqs add column if not exists pr_id uuid references public.purchase_requisitions (id) on delete set null;
create index if not exists rfqs_pr_id_idx on public.rfqs (pr_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  po_number text not null,
  vendor_id uuid not null references public.contacts (id) on delete restrict,
  pr_id uuid references public.purchase_requisitions (id) on delete set null,
  rfq_id uuid references public.rfqs (id) on delete set null,
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  payment_terms text,
  delivery_date date,
  tax_amount numeric(18, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(18, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'pending_approval'
    check (status in ('draft', 'pending_approval', 'approved', 'released', 'closed', 'rejected')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, po_number)
);

create table public.po_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  item_id uuid references public.catalog_items (id) on delete restrict,
  description text not null,
  quantity numeric(18, 4) not null check (quantity > 0),
  rate numeric(18, 2) not null default 0 check (rate >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_total numeric(18, 2) not null default 0 check (line_total >= 0)
);

create index purchase_orders_org_idx on public.purchase_orders (org_id, created_at desc);
create index po_lines_po_id_idx on public.po_lines (po_id);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  grn_number text not null,
  po_id uuid not null references public.purchase_orders (id) on delete restrict,
  warehouse text not null default 'Main warehouse',
  receipt_date date not null default current_date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, grn_number)
);

create table public.grn_lines (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null references public.goods_receipts (id) on delete cascade,
  po_line_id uuid not null references public.po_lines (id) on delete restrict,
  received_qty numeric(18, 4) not null default 0 check (received_qty >= 0),
  rejected_qty numeric(18, 4) not null default 0 check (rejected_qty >= 0)
);

create index goods_receipts_org_idx on public.goods_receipts (org_id, created_at desc);
create index grn_lines_grn_id_idx on public.grn_lines (grn_id);

create table public.service_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ses_number text not null,
  po_id uuid not null references public.purchase_orders (id) on delete restrict,
  description text not null,
  amount numeric(18, 2) not null default 0 check (amount >= 0),
  status text not null default 'performed'
    check (status in ('performed', 'confirmed', 'manager_review', 'approved', 'rejected')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, ses_number)
);

create index service_entries_org_idx on public.service_entries (org_id, created_at desc);

alter table public.bills add column if not exists po_id uuid references public.purchase_orders (id) on delete set null;
alter table public.bills add column if not exists invoice_date date;
alter table public.bills add column if not exists match_status text not null default 'not_required'
  check (match_status in ('not_required', 'pending', 'pass', 'exception', 'waived'));
alter table public.bills add column if not exists on_hold boolean not null default false;
create index if not exists bills_po_id_idx on public.bills (po_id);

create table public.three_way_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  po_id uuid references public.purchase_orders (id) on delete set null,
  grn_id uuid references public.goods_receipts (id) on delete set null,
  status text not null check (status in ('pass', 'exception')),
  po_qty numeric(18, 4) not null default 0,
  grn_qty numeric(18, 4) not null default 0,
  invoice_qty numeric(18, 4) not null default 0,
  exception_stage text check (exception_stage in ('procurement', 'finance', 'closed')),
  created_at timestamptz not null default now(),
  unique (bill_id)
);

create index three_way_matches_org_idx on public.three_way_matches (org_id, created_at desc);

create table public.payment_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  status text not null default 'proposed'
    check (status in ('proposed', 'finance_approved', 'paid', 'confirmed', 'rejected')),
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_proposals_org_idx on public.payment_proposals (org_id, created_at desc);

create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();
create trigger purchase_requisitions_set_updated_at
before update on public.purchase_requisitions
for each row execute function public.set_updated_at();
create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();
create trigger goods_receipts_set_updated_at
before update on public.goods_receipts
for each row execute function public.set_updated_at();
create trigger service_entries_set_updated_at
before update on public.service_entries
for each row execute function public.set_updated_at();
create trigger payment_proposals_set_updated_at
before update on public.payment_proposals
for each row execute function public.set_updated_at();

alter table public.catalog_items enable row level security;
alter table public.purchase_requisitions enable row level security;
alter table public.pr_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_lines enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.grn_lines enable row level security;
alter table public.service_entries enable row level security;
alter table public.three_way_matches enable row level security;
alter table public.payment_proposals enable row level security;

create policy catalog_items_all on public.catalog_items for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy purchase_requisitions_all on public.purchase_requisitions for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy pr_lines_all on public.pr_lines for all to authenticated
  using (exists (select 1 from public.purchase_requisitions p where p.id = pr_id and p.org_id = private.user_org_id()))
  with check (exists (select 1 from public.purchase_requisitions p where p.id = pr_id and p.org_id = private.user_org_id()));
create policy purchase_orders_all on public.purchase_orders for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy po_lines_all on public.po_lines for all to authenticated
  using (exists (select 1 from public.purchase_orders p where p.id = po_id and p.org_id = private.user_org_id()))
  with check (exists (select 1 from public.purchase_orders p where p.id = po_id and p.org_id = private.user_org_id()));
create policy goods_receipts_all on public.goods_receipts for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy grn_lines_all on public.grn_lines for all to authenticated
  using (exists (select 1 from public.goods_receipts g where g.id = grn_id and g.org_id = private.user_org_id()))
  with check (exists (select 1 from public.goods_receipts g where g.id = grn_id and g.org_id = private.user_org_id()));
create policy service_entries_all on public.service_entries for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy three_way_matches_all on public.three_way_matches for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());
create policy payment_proposals_all on public.payment_proposals for all to authenticated
  using (org_id = private.user_org_id()) with check (org_id = private.user_org_id());

grant select, insert, update, delete on
  public.catalog_items,
  public.purchase_requisitions,
  public.pr_lines,
  public.purchase_orders,
  public.po_lines,
  public.goods_receipts,
  public.grn_lines,
  public.service_entries,
  public.three_way_matches,
  public.payment_proposals
to authenticated;

insert into public.catalog_items (org_id, sku, name, description, category, item_kind, unit, standard_cost)
select
  o.id,
  'LAP-' || lpad(g::text, 3, '0'),
  format(
    '%s %s %s',
    (array['Dell','HP','Lenovo','Apple','Asus','Acer','MSI','Samsung','LG','Huawei'])[1 + ((g - 1) % 10)],
    (array['Latitude','EliteBook','ThinkPad','MacBook Air','Zenbook','Swift','Modern 14','Galaxy Book','Gram','MateBook'])[1 + ((g - 1) % 10)],
    5000 + g
  ),
  format(
    'Business laptop %s. 16GB RAM, 512GB SSD, 14-inch display. SKU LAP-%s.',
    g,
    lpad(g::text, 3, '0')
  ),
  'laptop',
  'goods',
  'each',
  round((42990 + (g * 1237) + ((g % 7) * 500))::numeric, 2)
from public.organizations o
cross join generate_series(1, 100) as g
on conflict (org_id, sku) do nothing;

insert into public.catalog_items (org_id, sku, name, description, category, item_kind, unit, standard_cost)
select o.id, extra.sku, extra.name, extra.description, extra.category, extra.item_kind, 'each', extra.cost
from public.organizations o
cross join (
  values
    ('PRN-001', 'HP LaserJet Pro M404dn', 'Network laser printer for office use.', 'printer', 'goods', 28990::numeric),
    ('SW-001', 'Microsoft 365 Business (annual)', 'Annual software subscription for 25 seats.', 'software', 'service', 125000::numeric),
    ('SVC-IT', 'Managed IT Support (monthly)', 'On-site and remote IT support block.', 'it_support', 'service', 100000::numeric)
) as extra(sku, name, description, category, item_kind, cost)
on conflict (org_id, sku) do nothing;
