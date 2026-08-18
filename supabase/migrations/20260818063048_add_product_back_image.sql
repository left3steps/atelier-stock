alter table public.products
  add column back_image_path text;

comment on column public.products.back_image_path is
  'Supabase Storage path for the product back-view image.';
