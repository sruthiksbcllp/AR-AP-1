-- Preferred vendor on a purchase requisition, filled from vendor onboarding.

alter table public.purchase_requisitions
  add column if not exists vendor_id uuid references public.contacts (id) on delete restrict;

create index if not exists purchase_requisitions_vendor_id_idx
  on public.purchase_requisitions (vendor_id);

create or replace function public.validate_pr_vendor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.vendor_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.contacts c
    where c.id = new.vendor_id
      and c.org_id = new.org_id
      and c.type = 'vendor'
      and c.vendor_status is distinct from 'rejected'
  ) then
    raise exception 'purchase requisition vendor_id must reference an onboarded vendor in the same organization';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_requisitions_validate_vendor on public.purchase_requisitions;
create trigger purchase_requisitions_validate_vendor
before insert or update of vendor_id, org_id
on public.purchase_requisitions
for each row
execute function public.validate_pr_vendor();

grant execute on function public.validate_pr_vendor() to authenticated;
