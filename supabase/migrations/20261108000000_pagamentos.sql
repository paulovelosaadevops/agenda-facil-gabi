-- Pagamento antecipado: sinal para reservar o dia ou pagamento integral, registrado pela Gabi (sem integração).
-- Cada recebimento é um lançamento; a devolução de um sinal é um lançamento negativo.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  amount_cents int not null check (amount_cents <> 0),
  method text not null default 'pix' check (method in ('pix', 'dinheiro', 'cartao', 'outro')),
  -- 'sinal', 'restante', 'integral', 'devolucao' (só para exibir o histórico).
  kind text not null default 'sinal' check (kind in ('sinal', 'restante', 'integral', 'devolucao')),
  paid_at timestamptz not null default now()
);
create index on public.payments (appointment_id);

alter table public.payments enable row level security;
create policy "owner manages payments" on public.payments
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- Total pago no próprio agendamento: a agenda, o lucro e o painel da cliente leem sem somar lançamentos.
alter table public.appointments add column paid_cents int not null default 0;

create or replace function public.sync_appointment_paid() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.appointment_id, old.appointment_id);
begin
  update public.appointments
    set paid_cents = coalesce((select sum(amount_cents) from public.payments where appointment_id = target), 0)
    where id = target;
  return null;
end;
$$;

create trigger payments_sync_paid
  after insert or update or delete on public.payments
  for each row execute function public.sync_appointment_paid();
