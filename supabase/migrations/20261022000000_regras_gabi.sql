-- Regras de negócio do app da Gabriela Marqui Nail Designer.

------------------------------------------------------------------------------
-- 1. Estúdio único: o primeiro usuário cria o estúdio (a Gabi). Depois disso,
--    todo cadastro novo é de cliente.
------------------------------------------------------------------------------
create or replace function public.business_exists() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses);
$$;
grant execute on function public.business_exists() to anon, authenticated;

drop policy "owner manages business" on public.businesses;
create policy "owner reads business" on public.businesses
  for select using (owner_id = auth.uid());
create policy "owner updates business" on public.businesses
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "first user creates the business" on public.businesses
  for insert with check (owner_id = auth.uid() and not public.business_exists());

------------------------------------------------------------------------------
-- 2. Intervalo entre atendimentos (padrão 30 min).
--    Ex.: 09:00 + serviço de 2h → próximo início possível às 11:30.
--    blocked_until = fim + intervalo, e a restrição de exclusão usa esse fim
--    estendido: o banco recusa qualquer agendamento que invada o intervalo.
------------------------------------------------------------------------------
alter table public.businesses
  add column buffer_min int not null default 30 check (buffer_min between 0 and 240);

alter table public.appointments add column blocked_until timestamptz;

create or replace function public.set_blocked_until() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.blocked_until := new.ends_at + make_interval(
    mins => coalesce((select buffer_min from public.businesses where id = new.business_id), 0)
  );
  return new;
end;
$$;

create trigger appointments_blocked_until
  before insert or update of starts_at, ends_at, business_id on public.appointments
  for each row execute function public.set_blocked_until();

update public.appointments a
  set blocked_until = a.ends_at + make_interval(mins => b.buffer_min)
  from public.businesses b
  where b.id = a.business_id;

alter table public.appointments alter column blocked_until set not null;
alter table public.appointments drop constraint appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap exclude using gist (
  business_id with =,
  tstzrange(starts_at, blocked_until) with &&
) where (status in ('pending', 'confirmed'));

------------------------------------------------------------------------------
-- 3. Clientes com conta própria (login e senha) e dados obrigatórios.
------------------------------------------------------------------------------
alter table public.clients
  add column user_id uuid unique references auth.users(id) on delete set null,
  add column whatsapp boolean not null default true,
  add column instagram text not null default '';

create unique index clients_business_email_key on public.clients (business_id, lower(email)) where email is not null;

create policy "client reads own profile" on public.clients
  for select using (user_id = auth.uid());
create policy "client updates own profile" on public.clients
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "client reads own appointments" on public.appointments
  for select using (client_id in (select id from public.clients where user_id = auth.uid()));

-- Ao criar a conta, a cliente vira (ou é ligada a) uma ficha de cliente.
-- Se a Gabi já cadastrou esse telefone manualmente, a conta assume a ficha existente
-- (sem duplicar histórico). Telefone já ligado a outra conta: o cadastro é recusado.
create or replace function public.handle_new_client() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := new.raw_user_meta_data;
  bid uuid;
  affected int;
begin
  if meta->>'role' is distinct from 'client' then
    return new;
  end if;
  select id into bid from public.businesses order by created_at limit 1;
  if bid is null then
    raise exception 'studio_not_configured';
  end if;

  insert into public.clients (business_id, user_id, name, phone, whatsapp, instagram, email)
  values (
    bid, new.id, meta->>'name', meta->>'phone',
    coalesce((meta->>'whatsapp')::boolean, true), coalesce(meta->>'instagram', ''), new.email
  )
  on conflict (business_id, phone) do update set
    user_id = excluded.user_id,
    whatsapp = excluded.whatsapp,
    instagram = case when public.clients.instagram = '' then excluded.instagram else public.clients.instagram end,
    email = coalesce(public.clients.email, excluded.email)
  where public.clients.user_id is null;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'phone_already_registered';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_client
  after insert on auth.users
  for each row execute function public.handle_new_client();

------------------------------------------------------------------------------
-- 4. Serviços: exclusão (arquiva quando há histórico), combos e manutenção.
------------------------------------------------------------------------------
alter table public.services
  add column archived boolean not null default false,
  -- Retorno para manutenção: em quantos dias, qual serviço e quantos dias antes avisar.
  add column maintenance_days int check (maintenance_days between 1 and 365),
  add column maintenance_notice_days int not null default 1 check (maintenance_notice_days between 0 and 30),
  add column maintenance_service_id uuid references public.services(id) on delete set null,
  -- Combo: serviços incluídos (só para exibição; preço e duração são do combo).
  add column combo_service_ids uuid[] not null default '{}';

-- Serviços não são segredo: clientes logadas leem os não arquivados (nomes no histórico, combos).
create policy "authenticated reads services" on public.services
  for select to authenticated using (not archived);

------------------------------------------------------------------------------
-- 5. Alertas de manutenção.
--    Para cada cliente e serviço de retorno, pega o último atendimento que pede
--    manutenção. Some quando a cliente já tem um atendimento posterior desse tipo.
------------------------------------------------------------------------------
create table public.maintenance_notifications (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  notified_at timestamptz not null default now()
);
alter table public.maintenance_notifications enable row level security;

create view public.maintenance_alerts with (security_invoker = true) as
with done as (
  select distinct on (a.client_id, coalesce(s.maintenance_service_id, s.id))
    a.business_id,
    a.client_id,
    a.id as appointment_id,
    a.service_id,
    coalesce(s.maintenance_service_id, s.id) as return_service_id,
    a.starts_at as done_at,
    a.starts_at + make_interval(days => s.maintenance_days) as due_at,
    a.starts_at + make_interval(days => s.maintenance_days - s.maintenance_notice_days) as notify_at
  from public.appointments a
  join public.services s on s.id = a.service_id
  where s.maintenance_days is not null
    and a.status in ('completed', 'confirmed')
    and a.starts_at < now()
  order by a.client_id, coalesce(s.maintenance_service_id, s.id), a.starts_at desc
)
select
  d.*,
  c.name as client_name,
  c.phone as client_phone,
  c.whatsapp as client_whatsapp,
  c.user_id as client_user_id,
  s.name as service_name,
  rs.name as return_service_name
from done d
join public.clients c on c.id = d.client_id
join public.services s on s.id = d.service_id
join public.services rs on rs.id = d.return_service_id
where not exists (
  select 1 from public.appointments b
  where b.client_id = d.client_id
    and b.starts_at > d.done_at
    and b.status in ('pending', 'confirmed', 'completed')
    and b.service_id in (d.return_service_id, d.service_id)
);

grant select on public.maintenance_alerts to authenticated;
