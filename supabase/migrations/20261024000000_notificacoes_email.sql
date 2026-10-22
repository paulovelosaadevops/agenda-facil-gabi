-- Notificações por e-mail: a view de manutenção passa a trazer o e-mail da cliente
-- (coluna nova no fim, como o "create or replace view" exige).
create or replace view public.maintenance_alerts with (security_invoker = true) as
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
  rs.name as return_service_name,
  c.email as client_email
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
