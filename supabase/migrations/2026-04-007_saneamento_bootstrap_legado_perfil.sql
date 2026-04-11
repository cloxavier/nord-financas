begin;

-- Remove o trigger legado de criação automática de perfil.
-- A partir desta migration, apenas o fluxo novo permanece ativo.
drop trigger if exists on_auth_user_created on auth.users;

-- Remove a função antiga que criava perfil com role = 'admin'
-- e conflita conceitualmente com o fluxo atual de usuário pendente.
drop function if exists public.handle_new_user();

-- Documenta oficialmente que a coluna role é apenas legado de compatibilidade.
comment on column public.profiles.role is
'COLUNA LEGADA DE COMPATIBILIDADE. Não usar esta coluna como fonte principal de autorização em regras novas. O controle de acesso deve usar profiles.role_id + access_roles.permissions_json.';

-- Documenta a função ativa de bootstrap de perfil.
comment on function public.handle_new_user_profile() is
'Fluxo ativo de bootstrap de perfil. Cria ou atualiza perfis pendentes ao inserir auth.users, preservando o modelo de aprovação de acesso.';

commit;