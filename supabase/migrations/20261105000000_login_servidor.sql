-- Mudança no login (docs/mudanca-login.md), Etapa 1: as contas de cliente passam a ser criadas pelo servidor.
-- O servidor precisa achar a conta de login pelo e-mail (para ligar à ficha sem duplicar).
-- Só a chave de serviço (Edge Functions) executa: nunca exposta ao app.
create or replace function public.auth_user_id_by_email(p_email text) returns uuid
  language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
