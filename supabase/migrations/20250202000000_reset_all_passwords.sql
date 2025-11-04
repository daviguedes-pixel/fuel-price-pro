-- Resetar todas as senhas para sr123
-- Esta migração reseta todas as senhas de usuários para "sr123"
-- e marca todas como senhas temporárias

-- Função para resetar senha de um usuário específico
CREATE OR REPLACE FUNCTION reset_user_password(user_email TEXT, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Buscar o usuário pelo email
  SELECT id INTO user_record FROM auth.users WHERE email = user_email;
  
  IF user_record IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', user_email;
  END IF;
  
  -- Atualizar senha usando a função do Supabase Auth
  -- Nota: No Supabase, precisamos usar o Admin API ou a função update_user_by_id
  -- Esta função será chamada via RPC ou pelo backend
  PERFORM auth.update_user_by_id(
    user_record.id,
    '{"password": "' || new_password || '"}'
  );
  
  -- Marcar como senha temporária no user_profiles
  UPDATE public.user_profiles
  SET senha_temporaria = true,
      temporary_password = true,
      updated_at = NOW()
  WHERE user_id = user_record.id;
  
END;
$$;

-- Criar função para resetar todas as senhas
-- Nota: No Supabase, precisamos usar o Admin API via função Edge ou backend
-- Esta migração cria a estrutura, mas o reset real deve ser feito via Admin API

-- Função auxiliar para atualizar senha via RPC (requer service role)
CREATE OR REPLACE FUNCTION reset_all_passwords_to_default()
RETURNS TABLE(users_updated INTEGER, errors TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
  error_list TEXT[] := ARRAY[]::TEXT[];
  default_password TEXT := 'sr123';
BEGIN
  -- Iterar sobre todos os usuários
  FOR user_record IN 
    SELECT id, email FROM auth.users
  LOOP
    BEGIN
      -- Marcar como senha temporária no user_profiles
      UPDATE public.user_profiles
      SET senha_temporaria = true,
          temporary_password = true,
          updated_at = NOW()
      WHERE user_id = user_record.id;
      
      -- Se não existe perfil, criar um básico
      IF NOT FOUND THEN
        INSERT INTO public.user_profiles (
          user_id, 
          email, 
          nome, 
          perfil, 
          senha_temporaria, 
          temporary_password,
          created_at,
          updated_at
        )
        VALUES (
          user_record.id,
          user_record.email,
          COALESCE((user_record.raw_user_meta_data->>'nome')::TEXT, user_record.email),
          'analista_pricing',
          true,
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          senha_temporaria = true,
          temporary_password = true,
          updated_at = NOW();
      END IF;
      
      updated_count := updated_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_list := array_append(error_list, user_record.email || ': ' || SQLERRM);
    END;
  END LOOP;
  
  RETURN QUERY SELECT updated_count, error_list;
END;
$$;

-- Comentário importante
COMMENT ON FUNCTION reset_all_passwords_to_default() IS 
'Reseta todas as senhas temporárias e marca como temporárias. 
ATENÇÃO: Para resetar as senhas de fato no auth.users, é necessário usar o Admin API do Supabase via backend ou função Edge.';

-- Executar a função para marcar todas como temporárias
SELECT reset_all_passwords_to_default();

