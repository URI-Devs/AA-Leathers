-- ============================================================
-- AA LEATHERS — DATABASE SCHEMA + SECURITY  (run FIRST)
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to run once on a fresh project.
--
-- Design decisions (kept deliberately simple for a ~100 product shop):
--  * Variants and images live in JSONB columns on `products`
--    (matches how your JS already stores them).
--  * Order lines are a JSONB *snapshot* on `orders` (name/price at
--    time of purchase), so old orders never change if you edit a product.
--  * Customers can NOT insert orders directly. Orders are created only by
--    the `place_order()` function, which recomputes prices, delivery
--    charge and stock on the SERVER. (Otherwise anyone could open the
--    browser console and buy a wallet for Rs. 1.)
--  * Admins are normal Supabase Auth users whose profiles have
--    role = 'admin' (see 3-make-admin.sql). No passwords live in JS.
-- ============================================================

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text,
  email text,
  address text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);
-- At most THREE admin rows can exist. Admin credentials remain in Supabase Auth;
-- this limit is enforced by the database and is not exposed in the website UI.
create or replace function public.admin_limit_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    perform pg_advisory_xact_lock(847231);
    if (select count(*) from public.profiles where role = 'admin') >= 3 then
      raise exception 'At most three admin accounts are allowed.';
    end if;
  end if;
  return new;
end $$;

create trigger trg_admin_limit
before insert or update of role on public.profiles
for each row execute function public.admin_limit_guard();

-- A profile row is created automatically whenever someone signs up.
-- (Works whether or not email-confirmation is turned on.)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 100),
    new.email,
    'customer'                      -- never trust client-supplied roles
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- CATEGORIES ----------
create table public.categories (
  category_id text primary key,
  name text not null check (length(trim(name)) > 0)
);

-- ---------- PRODUCTS ----------
create table public.products (
  product_id text primary key,
  name text not null,
  article_no text not null unique,
  category_id text references public.categories(category_id) on delete set null,
  description text,
  price numeric not null check (price >= 0),
  variants jsonb not null default '[]',   -- [{variantID,color,size,stock,image}]
  images jsonb not null default '[]',     -- [publicUrl, ...]
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- DELIVERY CHARGES ----------
create table public.delivery_charges (
  charge_id text primary key,
  region text not null unique,
  amount numeric not null check (amount >= 0)
);

-- ---------- ORDERS ----------
create table public.orders (
  order_id text primary key,
  user_id uuid references public.profiles(id) on delete set null,   -- null = guest order
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  delivery_address text not null,
  region text not null,
  items jsonb not null,            -- [{productID,variantID,name,color,size,price,quantity}]
  subtotal numeric not null,
  delivery_charge numeric not null,
  total_amount numeric not null,
  payment_method text not null check (payment_method in ('COD','JazzCash','Easypaisa')),
  payment_status text not null default 'N/A',
  payment_proof_path text,         -- file path inside the PRIVATE payment-proofs bucket
  status text not null default 'Pending'
    check (status in ('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled')),
  order_date timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id);
create index orders_date_idx on public.orders(order_date);

-- ---------- REVIEWS (one per customer per product, editable) ----------
create table public.reviews (
  review_id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(product_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null default '',
  rating int not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews(product_id);

-- Stamp the display name from the real profile (so nobody can post as
-- someone else) and keep product/user fixed on edits.
create or replace function public.reviews_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.customer_name := coalesce((select name from public.profiles where id = new.user_id), 'Customer');
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.product_id := old.product_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger trg_reviews_before_write before insert or update on public.reviews
for each row execute function public.reviews_before_write();

-- ---------- CONTACT MESSAGES (your contact form currently sends nowhere) ----------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  contact text check (char_length(contact) <= 150),
  message text not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);

-- ---------- CUSTOMER STATE ----------
-- Authenticated cart and wishlist sync across devices. Guest state remains
-- local until the customer signs in.
create table public.customer_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cart jsonb not null default '[]',
  wishlist jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Used inside security policies. SECURITY DEFINER avoids recursion on profiles.
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Nobody using the website can change a profile's role. (The owner can,
-- from the SQL editor, where there is no logged-in website user.)
create or replace function public.lock_role_column() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'role cannot be changed';
  end if;
  return new;
end $$;
create trigger trg_lock_role before update on public.profiles
for each row execute function public.lock_role_column();

-- ------------------------------------------------------------
-- place_order(): the ONLY way an order gets created.
-- Server-side it: validates input, re-reads real prices, checks and
-- decrements stock atomically (row locks), adds the delivery charge from
-- the delivery_charges table, and links the order to the logged-in user
-- (or leaves it as a guest order). Returns the new Order ID.
-- ------------------------------------------------------------
create or replace function public.place_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_region text,
  p_payment_method text,
  p_payment_proof_path text,
  p_items jsonb                 -- [{productID, variantID, quantity}]
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order_id text;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_delivery numeric;
  v_item jsonb;
  v_prod public.products%rowtype;
  v_variant jsonb;
  v_qty int;
  v_email text;
begin
  if length(trim(coalesce(p_customer_name, ''))) < 2 or length(p_customer_name) > 100 then
    raise exception 'Please enter your full name.';
  end if;
  if length(trim(coalesce(p_customer_phone, ''))) < 7 or length(p_customer_phone) > 25 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if length(trim(coalesce(p_delivery_address, ''))) < 5 or length(p_delivery_address) > 400 then
    raise exception 'Please enter your full delivery address.';
  end if;
  if p_payment_method not in ('COD','JazzCash','Easypaisa') then
    raise exception 'Invalid payment method.';
  end if;
  if p_payment_method <> 'COD' and coalesce(p_payment_proof_path, '') = '' then
    raise exception 'Please upload your payment screenshot.';
  end if;
  if p_payment_proof_path is not null and (length(p_payment_proof_path) > 250 or p_payment_proof_path like '%..%') then
    raise exception 'Invalid payment proof.';
  end if;

  select amount into v_delivery from public.delivery_charges where region = p_region;
  if not found then raise exception 'Please choose a valid delivery region.'; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your cart is empty.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'Invalid quantity.';
    end if;

    select * into v_prod from public.products
      where product_id = v_item->>'productID' and active for update;
    if not found then
      raise exception 'A product in your cart is no longer available.';
    end if;

    select e into v_variant from jsonb_array_elements(v_prod.variants) e
      where e->>'variantID' = v_item->>'variantID';
    if v_variant is null then
      raise exception '% is no longer available in that colour/size.', v_prod.name;
    end if;
    if coalesce((v_variant->>'stock')::int, 0) < v_qty then
      raise exception 'Sorry, only % left of % (%).', coalesce((v_variant->>'stock')::int, 0), v_prod.name, v_variant->>'color';
    end if;

    update public.products
    set variants = (
      select jsonb_agg(
        case when e->>'variantID' = v_item->>'variantID'
          then jsonb_set(e, '{stock}', to_jsonb((e->>'stock')::int - v_qty))
          else e end)
      from jsonb_array_elements(variants) e)
    where product_id = v_prod.product_id;

    v_subtotal := v_subtotal + v_prod.price * v_qty;
    v_items := v_items || jsonb_build_object(
      'productID', v_prod.product_id, 'variantID', v_variant->>'variantID',
      'name', v_prod.name, 'color', v_variant->>'color', 'size', v_variant->>'size',
      'price', v_prod.price, 'quantity', v_qty);
  end loop;

  if auth.uid() is not null then
    select email into v_email from public.profiles where id = auth.uid();
  end if;

  v_order_id := 'ORD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  insert into public.orders (
    order_id, user_id, customer_name, customer_email, customer_phone, delivery_address, region,
    items, subtotal, delivery_charge, total_amount, payment_method, payment_status,
    payment_proof_path, status)
  values (
    v_order_id, auth.uid(), trim(p_customer_name), v_email, trim(p_customer_phone), trim(p_delivery_address), p_region,
    v_items, v_subtotal, v_delivery, v_subtotal + v_delivery, p_payment_method,
    case when p_payment_method = 'COD' then 'N/A' else 'Awaiting Verification' end,
    p_payment_proof_path,
    case when p_payment_method = 'COD' then 'Confirmed' else 'Pending' end);

  return v_order_id;
end $$;

-- ------------------------------------------------------------
-- When an order is cancelled (admin cancels it, or rejects its payment),
-- the reserved stock goes back to the products automatically.
-- A cancelled order cannot be re-opened (the customer should re-order).
-- ------------------------------------------------------------
create or replace function public.orders_status_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if old.status = 'Cancelled' and new.status <> 'Cancelled' then
    raise exception 'A cancelled order cannot be re-opened. Ask the customer to place a new order.';
  end if;
  if old.status <> 'Cancelled' and new.status = 'Cancelled' then
    for it in select * from jsonb_array_elements(old.items) loop
      update public.products
      set variants = coalesce((
        select jsonb_agg(
          case when e->>'variantID' = it->>'variantID'
            then jsonb_set(e, '{stock}', to_jsonb((e->>'stock')::int + (it->>'quantity')::int))
            else e end)
        from jsonb_array_elements(variants) e), '[]'::jsonb)
      where product_id = it->>'productID';
    end loop;
  end if;
  return new;
end $$;
create trigger trg_orders_status_guard before update of status on public.orders
for each row execute function public.orders_status_guard();

-- ------------------------------------------------------------
-- track_order_public(): lets a GUEST look up ONE order by its (hard to
-- guess) Order ID. Shows only status/items/total — never name, phone,
-- address or payment proof.
-- ------------------------------------------------------------
create or replace function public.track_order_public(p_order_id text)
returns table (order_id text, status text, payment_status text, payment_method text,
               total_amount numeric, order_date timestamptz, items jsonb)
language sql security definer stable set search_path = public as $$
  select o.order_id, o.status, o.payment_status, o.payment_method, o.total_amount, o.order_date, o.items
  from public.orders o where o.order_id = upper(trim(p_order_id));
$$;

grant execute on function public.place_order(text,text,text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.track_order_public(text) to anon, authenticated;

-- ============================================================
-- PRIVILEGES: customers may only edit their own name/phone/address
-- ============================================================
revoke update on public.profiles from anon, authenticated;
grant update (name, phone, address) on public.profiles to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.delivery_charges enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;
alter table public.customer_state enable row level security;

-- profiles: see/edit only your own row (admin can see all).
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- catalog: everyone can read; only admin can change.
create policy categories_read on public.categories for select using (true);
create policy categories_ins on public.categories for insert with check (public.is_admin());
create policy categories_upd on public.categories for update using (public.is_admin());
create policy categories_del on public.categories for delete using (public.is_admin());

create policy products_read on public.products for select using (active or public.is_admin());
create policy products_ins on public.products for insert with check (public.is_admin());
create policy products_upd on public.products for update using (public.is_admin());
create policy products_del on public.products for delete using (public.is_admin());

create policy delivery_read on public.delivery_charges for select using (true);
create policy delivery_ins on public.delivery_charges for insert with check (public.is_admin());
create policy delivery_upd on public.delivery_charges for update using (public.is_admin());
create policy delivery_del on public.delivery_charges for delete using (public.is_admin());

-- orders: NO insert policy (only place_order() can create orders).
-- Customers read their own; admin reads/updates all.
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin());

-- reviews: public read. You can write a review only for a product you
-- have actually ordered (and not cancelled) — so "Verified Buyer" is true.
create policy reviews_read on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.user_id = auth.uid()
      and o.status <> 'Cancelled'
      and o.items @> jsonb_build_array(jsonb_build_object('productID', product_id))
  )
);
create policy reviews_update_own on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_admin_delete on public.reviews for delete using (public.is_admin());

-- contact form: anyone may send a message; only admin can read them.
create policy contact_insert on public.contact_messages for insert with check (true);
create policy contact_admin_read on public.contact_messages for select using (public.is_admin());

create policy customer_state_select_own on public.customer_state
  for select using (user_id = auth.uid());
create policy customer_state_insert_own on public.customer_state
  for insert with check (user_id = auth.uid());
create policy customer_state_update_own on public.customer_state
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- STORAGE (file uploads)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true,  2097152, array['image/jpeg','image/png','image/webp']),
  ('payment-proofs', 'payment-proofs', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- product photos: anyone can view, only admin can upload/change.
create policy product_images_read on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_ins  on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_upd  on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
create policy product_images_del  on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

-- payment screenshots: anyone can upload one at checkout (guests included);
-- ONLY admin can view them (via short-lived signed links).
create policy payment_proofs_ins  on storage.objects for insert with check (bucket_id = 'payment-proofs');
create policy payment_proofs_read on storage.objects for select using (bucket_id = 'payment-proofs' and public.is_admin());
