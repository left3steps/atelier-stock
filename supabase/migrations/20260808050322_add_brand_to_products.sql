alter table public.products
  add column brand text not null default 'YOUNHEEPARK'
  check (length(trim(brand)) > 0);

update public.products
set brand = 'KRISPY'
where name ilike '크리스피 %'
   or product_code ilike 'CY%'
   or product_code ilike 'KRISPY-%';

create index products_brand_idx on public.products(brand);

comment on column public.products.brand is
  'Brand label used to classify and filter products.';
