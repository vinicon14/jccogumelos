create extension if not exists "pgcrypto";

create type account_type as enum ('varejo', 'atacado');
create type user_role as enum ('customer', 'admin');
create type order_status as enum (
  'aguardando_pagamento',
  'pago',
  'em_separacao',
  'enviado',
  'entregue',
  'cancelado'
);
create type subscription_cadence as enum ('semanal', 'quinzenal', 'mensal');
create type coupon_type as enum ('percent', 'fixed', 'shipping');
create type media_type as enum ('image', 'video');
create type notification_audience as enum ('admin', 'customer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  cep text not null default '',
  street text not null default '',
  neighborhood text not null default '',
  city text not null,
  state text not null default '',
  account_type account_type not null default 'varejo',
  role user_role not null default 'customer',
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  description text not null,
  benefits text[] not null default '{}',
  weight text not null,
  price numeric(10, 2) not null,
  wholesale_price numeric(10, 2),
  stock integer not null default 0,
  rating numeric(2, 1) not null default 4.8,
  reviews integer not null default 0,
  nutrition text,
  image_url text not null,
  media_type media_type not null default 'image',
  tags text[] not null default '{}',
  best_seller boolean not null default false,
  is_new boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  status order_status not null default 'aguardando_pagamento',
  payment_method text,
  subtotal numeric(10, 2) not null default 0,
  shipping numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  subtotal numeric(10, 2) not null
);

create table public.coupons (
  code text primary key,
  type coupon_type not null,
  value numeric(10, 2) not null,
  min_order numeric(10, 2) not null default 0,
  expires_at date not null,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  is_active boolean not null default true
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  plan_name text not null,
  cadence subscription_cadence not null,
  price numeric(10, 2) not null,
  status text not null default 'ativa',
  next_billing_at date,
  created_at timestamptz not null default now()
);

create table public.loyalty_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'JC Cogumelos',
  logo_url text,
  instagram text default '@jc_cogumelos',
  facebook text,
  whatsapp text,
  email text,
  payment_methods text[] not null default array['pix', 'credito', 'debito'],
  payment_gateway jsonb not null default '{"enabled": false, "provider": "Banco", "environment": "sandbox", "api_endpoint": "", "merchant_id": "", "pix_key": "", "pix_receiver_name": "JC Cogumelos", "pix_receiver_city": "SAO PAULO", "pix_expiration_minutes": 5, "webhook_url": ""}'::jsonb,
  shipping_config jsonb not null default '{}'::jsonb,
  external_apis jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.assistant_settings (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  auto_whatsapp_enabled boolean not null default true,
  behavior text not null default 'Atender com tom acolhedor, gourmet e objetivo.',
  canned_responses jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  image_url text,
  media_type media_type not null default 'image',
  published boolean not null default false,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience notification_audience not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.subscriptions enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.assistant_settings enable row level security;
alter table public.blog_posts enable row level security;
alter table public.notifications enable row level security;

create policy "Public can read active products"
  on public.products for select
  using (is_active = true);

create policy "Public can read active coupons"
  on public.coupons for select
  using (is_active = true);

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can read own orders"
  on public.orders for select
  using (auth.uid() = profile_id);

create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (published = true);

create policy "Admins can manage blog posts"
  on public.blog_posts for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Users can read own notifications"
  on public.notifications for select
  using (
    audience = 'customer'
    or profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
      and notifications.audience = 'admin'
    )
  );
