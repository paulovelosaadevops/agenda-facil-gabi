-- agenda-facil: schema inicial
create extension if not exists btree_gist;

-- Negócio (a profissional). Um usuário pode ter um negócio; o modelo já suporta vários.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  phone text,
  address text,
  timezone text not null default 'America/Sao_Paulo',
  slot_interval_min int not null default 30 check (slot_interval_min between 5 and 120),
  min_advance_hours int not null default 2 check (min_advance_hours >= 0),
  max_advance_days int not null default 60 check (max_advance_days between 1 and 365),
  reminder_hours_before int not null default 24 check (reminder_hours_before between 1 and 168),
  ai_enabled boolean not null default true,
  ai_instructions text not null default '',
  created_at timestamptz not null default now()
);
create index on public.businesses (owner_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_min int not null check (duration_min between 5 and 600),
  price_cents int not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.services (business_id);

-- Expediente semanal: vários intervalos por dia (ex.: 09-12 e 13-18). weekday 0 = domingo.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on public.working_hours (business_id, weekday);

-- Bloqueios: folgas, férias, compromissos.
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  check (ends_at > starts_at)
);
create index on public.time_off (business_id, starts_at);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  -- só dígitos com DDI, ex.: 5511999998888
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  email text,
  birthday date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, phone)
);

create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('panel', 'public', 'whatsapp');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  source public.appointment_source not null default 'panel',
  price_cents int not null default 0,
  notes text not null default '',
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Impede dois horários ativos sobrepostos, mesmo com requisições concorrentes.
  constraint appointments_no_overlap exclude using gist (
    business_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'))
);
create index on public.appointments (business_id, starts_at);
create index on public.appointments (client_id);

create type public.message_direction as enum ('in', 'out');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  phone text not null,
  direction public.message_direction not null,
  body text not null,
  kind text not null default 'chat', -- chat | confirmation | reminder
  provider text not null,
  provider_message_id text,
  created_at timestamptz not null default now()
);
create index on public.messages (business_id, phone, created_at desc);

-- Row Level Security: a dona do negócio enxerga apenas os próprios dados.
-- Fluxos públicos (página de agendamento, webhook, cron) rodam no servidor com a service role.
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.messages enable row level security;

create policy "owner manages business" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.owns_business(bid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = bid and owner_id = auth.uid());
$$;

create policy "owner manages services" on public.services
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner manages working_hours" on public.working_hours
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner manages time_off" on public.time_off
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner manages clients" on public.clients
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner manages appointments" on public.appointments
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));
create policy "owner reads messages" on public.messages
  for select using (public.owns_business(business_id));
