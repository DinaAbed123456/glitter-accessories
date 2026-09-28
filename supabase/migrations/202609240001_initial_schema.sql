-- Glitter Accessories initial schema. Apply with `supabase db push` or the SQL editor.
create extension if not exists pgcrypto;

create type public.discount_type as enum ('percentage', 'fixed');
create type public.order_status as enum ('جديد', 'قيد المعالجة', 'قيد التجهيز', 'خرج للتوصيل', 'تم التسليم', 'ملغي');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', phone text, address text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
  image_url text, is_visible boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id) on delete set null,
  name text not null, description text not null default '', price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2) check (old_price is null or old_price >= price), stock integer not null default 0 check (stock >= 0),
  is_visible boolean not null default false, is_featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null, alt_text text not null default '', sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.offers (
  id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  discount_type public.discount_type not null, discount_value numeric(10,2) not null check (discount_value > 0),
  starts_at timestamptz not null, ends_at timestamptz not null, is_active boolean not null default false,
  created_at timestamptz not null default now(), check (ends_at > starts_at)
);
create table public.offer_products (
  offer_id uuid not null references public.offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, primary key (offer_id, product_id)
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(), code text unique not null,
  discount_type public.discount_type not null, discount_value numeric(10,2) not null check (discount_value > 0),
  minimum_order numeric(10,2) not null default 0 check (minimum_order >= 0),
  starts_at timestamptz not null, ends_at timestamptz not null,
  usage_limit integer check (usage_limit is null or usage_limit >= 0), usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default false, created_at timestamptz not null default now(), check (ends_at > starts_at)
);
create table public.banners (
  id uuid primary key default gen_random_uuid(), media_path text, media_type text not null default 'image' check (media_type in ('image','video')),
  title text not null default '', description text not null default '', sort_order integer not null default 0,
  is_active boolean not null default false, destination_type text not null default 'products' check (destination_type in ('offer','category','products','page')),
  destination_id uuid, destination_url text, created_at timestamptz not null default now()
);
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(), name text unique not null, fee numeric(10,2) not null check (fee >= 0),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
  user_id uuid references auth.users(id) on delete set null, guest_email text, guest_name text not null, guest_phone text not null,
  delivery_address text not null, delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_zone_name text not null, subtotal numeric(10,2) not null check (subtotal >= 0), discount numeric(10,2) not null default 0 check (discount >= 0),
  delivery_fee numeric(10,2) not null check (delivery_fee >= 0), total numeric(10,2) not null check (total >= 0),
  coupon_id uuid references public.coupons(id) on delete set null, status public.order_status not null default 'جديد',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0), quantity integer not null check (quantity > 0), line_total numeric(10,2) not null check (line_total >= 0)
);
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, product_id)
);
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade, role text not null check (role in ('admin','staff')),
  is_active boolean not null default true, created_by uuid references public.admin_users(user_id), created_at timestamptz not null default now()
);
create table public.admin_permissions (
  user_id uuid not null references public.admin_users(user_id) on delete cascade,
  section text not null check (section in ('products','categories','offers','coupons','banners','orders','delivery_zones','staff','audit_logs','settings')),
  can_read boolean not null default false, can_write boolean not null default false, primary key (user_id, section)
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  action text not null, entity text not null, entity_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.store_settings (
  setting_key text primary key check (setting_key ~ '^[a-z0-9_.-]{2,100}$'), setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);

create index products_visible_idx on public.products(is_visible, category_id);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.is_admin(p_section text default null, p_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a left join public.admin_permissions p on p.user_id = a.user_id and p.section = p_section
    where a.user_id = (select auth.uid()) and a.is_active and (a.role = 'admin' or
      (p_section is not null and case when p_write then coalesce(p.can_write,false) else coalesce(p.can_read,false) end))
  );
$$;
create or replace function public.is_root_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='admin' and a.is_active);
$$;
create or replace function public.current_admin_role()
returns text language sql stable security definer set search_path = '' as $$
  select a.role from public.admin_users a where a.user_id=(select auth.uid()) and a.is_active limit 1;
$$;
grant execute on function public.current_admin_role() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.offers enable row level security;
alter table public.offer_products enable row level security;
alter table public.coupons enable row level security;
alter table public.banners enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.favorites enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.store_settings enable row level security;

create policy "profiles self or authorized staff read" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin('orders'));
create policy "profiles self update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "public reads visible categories" on public.categories for select using (is_visible or public.is_admin('categories'));
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin('categories',true)) with check (public.is_admin('categories',true));
create policy "public reads visible products" on public.products for select using (is_visible or public.is_admin('products'));
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin('products',true)) with check (public.is_admin('products',true));
create policy "public reads product images" on public.product_images for select using (exists(select 1 from public.products p where p.id=product_id and p.is_visible) or public.is_admin('products'));
create policy "admins manage product images" on public.product_images for all to authenticated using (public.is_admin('products',true)) with check (public.is_admin('products',true));
create policy "public reads active offers" on public.offers for select using ((is_active and now() between starts_at and ends_at) or public.is_admin('offers'));
create policy "admins manage offers" on public.offers for all to authenticated using (public.is_admin('offers',true)) with check (public.is_admin('offers',true));
create policy "public reads offer links" on public.offer_products for select using (exists(select 1 from public.offers o where o.id=offer_id and o.is_active));
create policy "admins manage offer links" on public.offer_products for all to authenticated using (public.is_admin('offers',true)) with check (public.is_admin('offers',true));
create policy "admins manage coupons" on public.coupons for all to authenticated using (public.is_admin('coupons',true)) with check (public.is_admin('coupons',true));
create policy "public reads active banners" on public.banners for select using (is_active or public.is_admin('banners'));
create policy "admins manage banners" on public.banners for all to authenticated using (public.is_admin('banners',true)) with check (public.is_admin('banners',true));
create policy "public reads delivery zones" on public.delivery_zones for select using (is_active or public.is_admin('delivery_zones'));
create policy "admins manage delivery zones" on public.delivery_zones for all to authenticated using (public.is_admin('delivery_zones',true)) with check (public.is_admin('delivery_zones',true));
create policy "owners or order staff read orders" on public.orders for select to authenticated using (user_id=(select auth.uid()) or public.is_admin('orders'));
create policy "order staff update orders" on public.orders for update to authenticated using (public.is_admin('orders',true)) with check (public.is_admin('orders',true));
create policy "owners or order staff read items" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_admin('orders'))));
create policy "users manage own favorites" on public.favorites for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "admins read staff" on public.admin_users for select to authenticated using (public.is_admin('staff'));
create policy "root manages staff" on public.admin_users for all to authenticated using (public.is_admin('staff',true) and exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='admin')) with check (public.is_admin('staff',true) and exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='admin'));
create policy "root admins manage permissions" on public.admin_permissions for all to authenticated using (public.is_root_admin()) with check (public.is_root_admin());
create policy "admins read audit logs" on public.audit_logs for select to authenticated using (public.is_admin('audit_logs'));
create policy "admins manage settings" on public.store_settings for all to authenticated using (public.is_admin('settings',true)) with check (public.is_admin('settings',true));

insert into public.delivery_zones(name,fee) values ('القدس',30),('الداخل',70),('الضفة',20) on conflict(name) do update set fee=excluded.fee;

-- Upload product and banner assets to the private product-media bucket; generate signed URLs server-side.
insert into storage.buckets(id,name,public) values ('product-media','product-media',false) on conflict(id) do nothing;
create policy "admin media access" on storage.objects for all to authenticated using (bucket_id='product-media' and (public.is_admin('products',true) or public.is_admin('banners',true))) with check (bucket_id='product-media' and (public.is_admin('products',true) or public.is_admin('banners',true)));
create policy "public reads visible media" on storage.objects for select to anon, authenticated using (
  bucket_id='product-media' and (
    exists(select 1 from public.product_images i join public.products p on p.id=i.product_id where i.storage_path=name and p.is_visible)
    or exists(select 1 from public.banners b where b.media_path=name and b.is_active)
  )
);

-- Safe catalog seed. Replace/extend products and categories through the secured admin workflow.
insert into public.categories(name,slug,sort_order) values ('قلائد','necklaces',1),('خواتم','rings',2),('أساور','bracelets',3),('أقراط','earrings',4),('أطقم','sets',5) on conflict(slug) do nothing;
insert into public.products(category_id,name,description,price,old_price,stock,is_visible,is_featured)
select c.id, seed.name, seed.description, seed.price, seed.old_price, seed.stock, true, seed.featured
from (values
  ('necklaces','قلادة لورا الناعمة','قلادة أنيقة بتفاصيل ناعمة لإطلالة يومية.',129::numeric,165::numeric,18,true),
  ('bracelets','سوار سيلين الذهبي','سوار بتصميم كلاسيكي ولمسة ذهبية.',95::numeric,120::numeric,24,true),
  ('earrings','أقراط إيلا الكريستالية','أقراط خفيفة بلمعة كريستالية رقيقة.',79::numeric,null::numeric,12,false),
  ('sets','طقم أورا الذهبي','طقم متناسق لإطلالة متكاملة ومميزة.',189::numeric,240::numeric,9,true)
) as seed(slug,name,description,price,old_price,stock,featured)
join public.categories c on c.slug=seed.slug
where not exists(select 1 from public.products p where p.name=seed.name);
insert into public.offers(name,description,discount_type,discount_value,starts_at,ends_at,is_active)
select 'تخفيضات البداية','خصومات مختارة على قطع محددة.','percentage',20,now()-interval '1 day',now()+interval '30 days',true
where not exists(select 1 from public.offers where name='تخفيضات البداية');
insert into public.offer_products(offer_id,product_id)
select o.id,p.id from public.offers o join public.products p on p.name in ('قلادة لورا الناعمة','سوار سيلين الذهبي')
where o.name='تخفيضات البداية' on conflict do nothing;

-- Checkout is the only public write path for orders. Prices, coupon value, shipping and stock
-- are read and checked again in this transaction; client totals are never accepted.
create or replace function public.checkout_order(
  p_guest_name text, p_guest_phone text, p_guest_email text, p_delivery_address text,
  p_delivery_zone_id uuid, p_coupon_code text, p_items jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid()); v_zone public.delivery_zones%rowtype;
  v_product public.products%rowtype; v_coupon public.coupons%rowtype;
  v_order public.orders%rowtype; v_subtotal numeric(10,2) := 0; v_discount numeric(10,2) := 0;
  v_total numeric(10,2); v_item jsonb; v_qty integer; v_unit_price numeric(10,2); v_coupon_id uuid := null;
begin
  if length(trim(p_guest_name)) not between 2 and 120 or length(trim(p_guest_phone)) not between 6 and 40
    or length(trim(p_delivery_address)) not between 5 and 500 then raise exception 'بيانات التوصيل غير مكتملة'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'السلة غير صالحة'; end if;
  select * into v_zone from public.delivery_zones where id=p_delivery_zone_id and is_active for share;
  if not found then raise exception 'منطقة التوصيل غير متاحة'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if (v_item->>'product_id') is null or (v_item->>'quantity') !~ '^[0-9]+$' then raise exception 'منتج أو كمية غير صالحة'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty not between 1 and 20 then raise exception 'الكمية المطلوبة غير صالحة'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_visible for update;
    if not found or v_product.stock < v_qty then raise exception 'المنتج غير متوفر بالكمية المطلوبة'; end if;
    select v_product.price - least(v_product.price,case when o.discount_type='percentage' then round(v_product.price*least(o.discount_value,100)/100,2) else o.discount_value end)
      into v_unit_price from public.offer_products op join public.offers o on o.id=op.offer_id
      where op.product_id=v_product.id and o.is_active and now() between o.starts_at and o.ends_at
      order by case when o.discount_type='percentage' then v_product.price*least(o.discount_value,100)/100 else o.discount_value end desc limit 1;
    if v_unit_price is null then v_unit_price:=v_product.price; end if;
    v_subtotal := v_subtotal + v_unit_price * v_qty;
  end loop;
  if nullif(trim(p_coupon_code),'') is not null then
    select * into v_coupon from public.coupons where code=upper(trim(p_coupon_code)) and is_active
      and now() between starts_at and ends_at and (usage_limit is null or usage_count < usage_limit) for update;
    if not found then raise exception 'كود الخصم غير صالح أو منتهي'; end if;
    if v_subtotal < v_coupon.minimum_order then raise exception 'قيمة الطلب أقل من الحد الأدنى للكوبون'; end if;
    v_discount := case when v_coupon.discount_type='percentage' then round(v_subtotal*least(v_coupon.discount_value,100)/100,2) else least(v_coupon.discount_value,v_subtotal) end;
    v_coupon_id := v_coupon.id;
  end if;
  v_total := v_subtotal - v_discount + v_zone.fee;
  insert into public.orders(user_id,guest_email,guest_name,guest_phone,delivery_address,delivery_zone_id,delivery_zone_name,subtotal,discount,delivery_fee,total,coupon_id)
  values(v_user,nullif(trim(p_guest_email),''),trim(p_guest_name),trim(p_guest_phone),trim(p_delivery_address),v_zone.id,v_zone.name,v_subtotal,v_discount,v_zone.fee,v_total,v_coupon_id) returning * into v_order;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    select v_product.price - least(v_product.price,case when o.discount_type='percentage' then round(v_product.price*least(o.discount_value,100)/100,2) else o.discount_value end)
      into v_unit_price from public.offer_products op join public.offers o on o.id=op.offer_id
      where op.product_id=v_product.id and o.is_active and now() between o.starts_at and o.ends_at
      order by case when o.discount_type='percentage' then v_product.price*least(o.discount_value,100)/100 else o.discount_value end desc limit 1;
    if v_unit_price is null then v_unit_price:=v_product.price; end if;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
      values(v_order.id,v_product.id,v_product.name,v_unit_price,v_qty,v_unit_price*v_qty);
    update public.products set stock=stock-v_qty, updated_at=now() where id=v_product.id;
  end loop;
  if v_coupon_id is not null then update public.coupons set usage_count=usage_count+1 where id=v_coupon_id; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,details)
    values(v_user,'create','order',v_order.id::text,jsonb_build_object('order_number',v_order.order_number,'total',v_total));
  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'total',v_total,'status',v_order.status);
end;
$$;
grant execute on function public.checkout_order(text,text,text,text,uuid,text,jsonb) to anon, authenticated;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb; v_new jsonb; v_id text; v_action text;
begin
  v_old := case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_new := case when tg_op='DELETE' then null else to_jsonb(new) end;
  if tg_table_name='orders' then
    v_old := v_old - 'guest_email' - 'guest_name' - 'guest_phone' - 'delivery_address';
    v_new := v_new - 'guest_email' - 'guest_name' - 'guest_phone' - 'delivery_address';
  end if;
  v_id := coalesce(v_new->>'id',v_old->>'id',v_new->>'user_id',v_old->>'user_id',
    v_new->>'offer_id' || ':' || v_new->>'product_id',v_old->>'offer_id' || ':' || v_old->>'product_id',
    v_new->>'setting_key',v_old->>'setting_key');
  v_action := lower(tg_op);
  if tg_table_name='orders' and tg_op='UPDATE' and (v_old->>'status') is distinct from (v_new->>'status') then v_action := 'status_change'; end if;
  insert into public.audit_logs(actor_id,action,entity,entity_id,details)
  values((select auth.uid()),v_action,tg_table_name,v_id,jsonb_build_object('old',v_old,'new',v_new));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger audit_products after insert or update or delete on public.products for each row execute function public.write_audit_log();
create trigger audit_product_images after insert or update or delete on public.product_images for each row execute function public.write_audit_log();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.write_audit_log();
create trigger audit_offers after insert or update or delete on public.offers for each row execute function public.write_audit_log();
create trigger audit_offer_products after insert or update or delete on public.offer_products for each row execute function public.write_audit_log();
create trigger audit_coupons after insert or update or delete on public.coupons for each row execute function public.write_audit_log();
create trigger audit_banners after insert or update or delete on public.banners for each row execute function public.write_audit_log();
create trigger audit_delivery_zones after insert or update or delete on public.delivery_zones for each row execute function public.write_audit_log();
create trigger audit_orders after insert or update or delete on public.orders for each row execute function public.write_audit_log();
create trigger audit_admin_users after insert or update or delete on public.admin_users for each row execute function public.write_audit_log();
create trigger audit_store_settings after insert or update or delete on public.store_settings for each row execute function public.write_audit_log();
