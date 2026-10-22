-- Notificações com destino próprio (ex.: manutenção abre um agendamento novo já preenchido).
alter table public.notifications add column url text;
