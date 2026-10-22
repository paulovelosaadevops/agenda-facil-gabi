-- Notificações da Gabi dentro do app (sino) e no celular (Web Push do app instalado).

-- 1) Sino: cada agendamento feito pelo link vira uma notificação (criada pelo próprio banco).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  kind text not null default 'booking',
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (business_id, created_at desc);
alter table public.notifications enable row level security;
create policy "owner reads notifications" on public.notifications
  for select using (public.owns_business(business_id));
create policy "owner marks notifications read" on public.notifications
  for update using (public.owns_business(business_id)) with check (public.owns_business(business_id));

create or replace function public.notify_new_booking() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  client_name text;
  service_name text;
  tz text;
begin
  if new.source <> 'public' then
    return new;
  end if;
  select name into client_name from public.clients where id = new.client_id;
  select name into service_name from public.services where id = new.service_id;
  select timezone into tz from public.businesses where id = new.business_id;
  insert into public.notifications (business_id, appointment_id, kind, title, body)
  values (
    new.business_id,
    new.id,
    'booking',
    coalesce(client_name, 'Cliente') || ' agendou ' || coalesce(service_name, 'um horário'),
    to_char(new.starts_at at time zone coalesce(tz, 'America/Sao_Paulo'), 'DD/MM "às" HH24:MI')
  );
  return new;
end;
$$;

create trigger appointments_notify_new_booking
  after insert on public.appointments
  for each row execute function public.notify_new_booking();

-- O app recebe as notificações novas na hora (Supabase Realtime respeita a RLS acima).
alter publication supabase_realtime add table public.notifications;

-- 2) Celular: assinaturas de Web Push dos aparelhos em que a Gabi ativou as notificações.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "owner manages own push subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid() and public.owns_business(business_id))
  with check (user_id = auth.uid() and public.owns_business(business_id));
