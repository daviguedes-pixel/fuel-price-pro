-- Core types
create type public.product_type as enum ('etanol','gasolina_comum','gasolina_aditivada','s10','s500');
create type public.reference_type as enum ('nf','print_portal','print_conversa','sem_referencia');
create type public.suggestion_status as enum ('draft','pending','approved','rejected');

-- Stations
create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  address text,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payment Methods
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('vista','cartao_28','cartao_35')) not null,
  fee_percentage numeric(6,3) not null default 0,
  days integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Price Suggestions
create table if not exists public.price_suggestions (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.stations(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  product public.product_type not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  cost_price numeric(10,3) not null,
  margin_cents integer not null default 0,
  final_price numeric(10,3) not null,
  reference_type public.reference_type,
  observations text,
  status public.suggestion_status not null default 'pending',
  requested_by text not null,
  approved_by text,
  approved_at timestamptz,
  attachments text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Price History
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references public.price_suggestions(id) on delete set null,
  station_id uuid references public.stations(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  product public.product_type not null,
  old_price numeric(10,3),
  new_price numeric(10,3) not null,
  margin_cents integer not null default 0,
  approved_by text,
  change_type text,
  created_at timestamptz not null default now()
);

-- Competitor Research
create table if not exists public.competitor_research (
  id uuid primary key default gen_random_uuid(),
  station_name text not null,
  address text,
  product public.product_type not null,
  price numeric(10,3) not null,
  date_observed timestamptz not null default now(),
  notes text,
  attachments text[],
  created_by text,
  created_at timestamptz not null default now()
);

-- User Profiles (permissions-lite to match app usage)
do $$ begin
  create type public.user_role as enum ('admin','supervisor','analista','gerente');
exception when duplicate_object then null; end $$;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null,
  nome text not null,
  cargo text,
  role public.user_role not null default 'analista',
  ativo boolean not null default true,
  max_approval_margin numeric(6,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.stations enable row level security;
alter table public.clients enable row level security;
alter table public.payment_methods enable row level security;
alter table public.price_suggestions enable row level security;
alter table public.price_history enable row level security;
alter table public.competitor_research enable row level security;
alter table public.user_profiles enable row level security;

-- Simple policies: allow authenticated to read all core tables
create policy if not exists "Read stations" on public.stations for select using (auth.role() = 'authenticated');
create policy if not exists "Read clients" on public.clients for select using (auth.role() = 'authenticated');
create policy if not exists "Read payment_methods" on public.payment_methods for select using (auth.role() = 'authenticated');
create policy if not exists "Read price_suggestions" on public.price_suggestions for select using (auth.role() = 'authenticated');
create policy if not exists "Read price_history" on public.price_history for select using (auth.role() = 'authenticated');
create policy if not exists "Read competitor_research" on public.competitor_research for select using (auth.role() = 'authenticated');
create policy if not exists "Read own profile or all (auth)" on public.user_profiles for select using (
  auth.role() = 'authenticated'
);

-- Insert policies (basic): allow authenticated inserts
create policy if not exists "Insert stations" on public.stations for insert with check (auth.role() = 'authenticated');
create policy if not exists "Insert clients" on public.clients for insert with check (auth.role() = 'authenticated');
create policy if not exists "Insert payment_methods" on public.payment_methods for insert with check (auth.role() = 'authenticated');
create policy if not exists "Insert price_suggestions" on public.price_suggestions for insert with check (auth.role() = 'authenticated');
create policy if not exists "Insert price_history" on public.price_history for insert with check (auth.role() = 'authenticated');
create policy if not exists "Insert competitor_research" on public.competitor_research for insert with check (auth.role() = 'authenticated');

-- Optional update policies for basic editing
create policy if not exists "Update price_suggestions" on public.price_suggestions for update using (auth.role() = 'authenticated');

-- Minimal seed so UI has data
-- Dados fictícios removidos - usar apenas dados reais das tabelas sis_empresa e clientes

-- Example competitor research (if none exists)
-- Dados fictícios removidos - usar apenas dados reais



