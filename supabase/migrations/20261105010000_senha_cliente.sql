-- Mudança no login (docs/mudanca-login.md), D8: a cliente tem senha, definida no primeiro agendamento.
-- O servidor precisa saber se a conta do e-mail já tem senha: com senha, o link pede a senha; sem, envia o código.
-- Só a chave de serviço (Edge Functions) executa: nunca exposta ao app.
-- (auth_user_id_by_email, da Etapa 1, fica até a Etapa 3 para não quebrar a função publicada durante a troca.)
-- "Tem senha" = marca has_password, gravada pelo app na mesma chamada que define a senha. O encrypted_password
-- não serve: o Auth grava uma senha aleatória até em contas criadas sem senha pela API de admin.
create or replace function public.auth_user_by_email(p_email text)
  returns table (id uuid, has_password boolean)
  language sql stable security definer set search_path = public, auth as $$
  select u.id, coalesce((u.raw_user_meta_data->>'has_password')::boolean, false)
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_by_email(text) to service_role;
