-- Antes de executar:
-- 1. Crie/convide o usuário em Supabase > Authentication > Users.
-- 2. Substitua o e-mail e o nome abaixo pelos valores da conta criada.
-- 3. Execute no SQL Editor do projeto Supabase.
INSERT INTO public.users (auth_user_id, username, display_name, password_hash, role, active)
SELECT id, email, 'Nome do Administrador', 'supabase-auth', 'admin', 1
FROM auth.users
WHERE lower(email) = lower('admin@municipio.gov.br')
ON CONFLICT (username) DO UPDATE
SET auth_user_id = EXCLUDED.auth_user_id,
    display_name = EXCLUDED.display_name,
    role = 'admin',
    active = 1;

INSERT INTO public.departments (name, active)
VALUES
  ('Administração', 1),
  ('Assistência Social', 1),
  ('Educação', 1),
  ('Finanças', 1),
  ('Meio Ambiente', 1),
  ('Obras e Serviços Urbanos', 1),
  ('Saúde', 1),
  ('Transportes', 1)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.system_flags (flag, value)
VALUES ('initial_admin', 'complete')
ON CONFLICT (flag) DO UPDATE SET value = EXCLUDED.value;
