-- Atelier Stock V1
-- Ledger-first apparel inventory schema for Supabase/Postgres.

create extension if not exists pgcrypto;

create type public.inventory_transaction_type as enum ('inbound', 'outbound');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  name text not null,
  category text,
  main_image_path text,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  color_name text not null,
  color_code text,
  color_image_path text,
  size text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color_name, size)
);

-- Fast current-state cache. The transaction ledger remains the source of truth.
create table public.inventory (
  variant_id uuid primary key references public.variants(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete restrict,
  transaction_type public.inventory_transaction_type not null,
  quantity integer not null check (quantity > 0),
  reason text not null,
  memo text,
  resulting_quantity integer not null check (resulting_quantity >= 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index variants_product_id_idx on public.variants(product_id);
create index variants_search_idx on public.variants(sku, color_name, size);
create index inventory_transactions_variant_created_idx
  on public.inventory_transactions(variant_id, created_at desc);
create index inventory_transactions_created_idx
  on public.inventory_transactions(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger variants_set_updated_at
before update on public.variants
for each row execute function public.set_updated_at();

create or replace function public.initialize_variant_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (variant_id, quantity)
  values (new.id, 0)
  on conflict (variant_id) do nothing;
  return new;
end;
$$;

create trigger variants_initialize_inventory
after insert on public.variants
for each row execute function public.initialize_variant_inventory();

-- The only supported path for changing stock. Row locking prevents lost updates.
create or replace function public.register_inventory_transaction(
  p_variant_id uuid,
  p_transaction_type public.inventory_transaction_type,
  p_quantity integer,
  p_reason text,
  p_memo text default null
)
returns public.inventory_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_result integer;
  v_transaction public.inventory_transactions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Reason is required';
  end if;

  insert into public.inventory (variant_id, quantity)
  values (p_variant_id, 0)
  on conflict (variant_id) do nothing;

  select quantity into v_current
  from public.inventory
  where variant_id = p_variant_id
  for update;

  v_result := case
    when p_transaction_type = 'inbound' then v_current + p_quantity
    else v_current - p_quantity
  end;

  if v_result < 0 then
    raise exception 'Insufficient stock: current %, requested %', v_current, p_quantity;
  end if;

  insert into public.inventory_transactions (
    variant_id, transaction_type, quantity, reason, memo,
    resulting_quantity, created_by
  ) values (
    p_variant_id, p_transaction_type, p_quantity, trim(p_reason),
    nullif(trim(coalesce(p_memo, '')), ''), v_result, auth.uid()
  ) returning * into v_transaction;

  update public.inventory
  set quantity = v_result, updated_at = now()
  where variant_id = p_variant_id;

  return v_transaction;
end;
$$;

revoke all on function public.register_inventory_transaction(uuid, public.inventory_transaction_type, integer, text, text) from public;
grant execute on function public.register_inventory_transaction(uuid, public.inventory_transaction_type, integer, text, text) to authenticated;

alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "authenticated users read products"
  on public.products for select to authenticated using (true);
create policy "authenticated users create products"
  on public.products for insert to authenticated with check (true);
create policy "authenticated users update products"
  on public.products for update to authenticated using (true) with check (true);

create policy "authenticated users read variants"
  on public.variants for select to authenticated using (true);
create policy "authenticated users create variants"
  on public.variants for insert to authenticated with check (true);
create policy "authenticated users update variants"
  on public.variants for update to authenticated using (true) with check (true);

create policy "authenticated users read inventory"
  on public.inventory for select to authenticated using (true);
create policy "authenticated users read transactions"
  on public.inventory_transactions for select to authenticated using (true);

-- Public product images simplify rendering across desktop/mobile browsers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can view product images"
  on storage.objects for select to public
  using (bucket_id = 'product-images');
create policy "authenticated users upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy "authenticated users update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy "authenticated users delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');

comment on table public.inventory is
  'Current stock cache maintained only by register_inventory_transaction.';
comment on table public.inventory_transactions is
  'Immutable source-of-truth ledger for every inbound and outbound movement.';
