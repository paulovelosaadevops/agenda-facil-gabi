-- Serviços de pés só para clientes liberadas pela Gabi.
alter table public.clients add column feet boolean not null default false;
comment on column public.clients.feet is 'A Gabi atende os pés desta cliente (libera os serviços de pés).';

alter table public.services add column feet boolean not null default false;
comment on column public.services.feet is 'Serviço de pés: só para clientes com clients.feet.';

-- Só a Gabi (ou o servidor) muda a liberação: a cliente pode editar o próprio perfil, mas não se liberar.
create or replace function public.protect_client_feet() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.feet is distinct from old.feet
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.owns_business(new.business_id) then
    new.feet := old.feet;
  end if;
  return new;
end;
$$;

create trigger clients_protect_feet
  before update on public.clients
  for each row execute function public.protect_client_feet();

-- Serviços com "pés" no nome já cadastrados (pedicure, mão + pé...) começam marcados; a Gabi ajusta depois.
update public.services set feet = true where name ~* '(p[ée]s?\M|pedicure)';
