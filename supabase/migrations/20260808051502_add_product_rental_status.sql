alter table public.products
  add column is_rented boolean not null default false,
  add column rented_at timestamptz;

update public.products
set brand = 'CRISPY'
where brand = 'KRISPY';

create index products_rented_idx on public.products(id)
where is_rented = true;

comment on column public.products.is_rented is
  'Whether the product is currently on rental.';

comment on column public.products.rented_at is
  'Timestamp when the current rental state started.';
