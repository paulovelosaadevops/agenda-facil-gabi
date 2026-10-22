-- Categoria do serviço, para separar a lista (painel e agendamento das clientes):
-- primeira = Primeira aplicação, manutencao = Manutenção, outros = Outros serviços.
alter table public.services
  add column category text not null default 'outros'
  check (category in ('primeira', 'manutencao', 'outros'));

-- Serviços já cadastrados: quem é retorno de outro vira "Manutenção"; quem pede retorno vira "Primeira aplicação".
update public.services s set category = 'manutencao'
  where exists (select 1 from public.services o where o.maintenance_service_id = s.id);
update public.services set category = 'primeira'
  where category = 'outros' and maintenance_days is not null;
