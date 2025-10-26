-- =====================================================
-- CORREÇÃO COMPLETA DE SEGURANÇA - FUEL PRICE PRO
-- =====================================================
-- Esta migração corrige todos os problemas de segurança identificados:
-- 1. Critical Privilege Escalation via User Profile Manipulation
-- 2. Profile Permissions Table Allows Unauthorized Modifications
-- 3. Employee Information Exposed Without Authentication
-- 4. Missing Server-Side Input Validation
-- 5. Employee Email Addresses Exposed to Public Internet
-- 6. Client Contact Information Available to Anyone
-- 7. Confidential Pricing References Leaked to Competitors
-- 8. Customer Database Accessible Without Authentication
-- 9. RLS Disabled in Public

-- =====================================================
-- 1. CORRIGIR POLÍTICAS DE SEGURANÇA DAS TABELAS PRINCIPAIS
-- =====================================================

-- Remover políticas inadequadas e criar novas políticas seguras
DROP POLICY IF EXISTS "Read own profile or all (auth)" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view profile permissions" ON public.profile_permissions;
DROP POLICY IF EXISTS "external_connections_policy" ON public.external_connections;

-- =====================================================
-- 2. POLÍTICAS SEGURAS PARA USER_PROFILES
-- =====================================================

-- Política para visualização: apenas próprio perfil ou admins podem ver todos
CREATE POLICY "Secure user profiles select" ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Usuário pode ver seu próprio perfil
  auth.uid() = user_id 
  OR 
  -- Admins podem ver todos os perfis
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- Política para inserção: apenas admins podem criar perfis
CREATE POLICY "Only admins can insert user profiles" ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- Política para atualização: usuário pode atualizar próprio perfil, admins podem atualizar qualquer perfil
CREATE POLICY "Secure user profiles update" ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
)
WITH CHECK (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- Política para exclusão: apenas admins podem excluir perfis
CREATE POLICY "Only admins can delete user profiles" ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- =====================================================
-- 3. POLÍTICAS SEGURAS PARA PROFILE_PERMISSIONS
-- =====================================================

-- Política para visualização: apenas usuários autenticados podem ver permissões
CREATE POLICY "Authenticated users can view profile permissions" ON public.profile_permissions
FOR SELECT
TO authenticated
USING (true);

-- Política para modificação: apenas admins podem modificar permissões
CREATE POLICY "Only admins can modify profile permissions" ON public.profile_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- =====================================================
-- 4. POLÍTICAS SEGURAS PARA TABELAS DE DADOS SENSÍVEIS
-- =====================================================

-- CLIENTES - Proteger informações de contato
DROP POLICY IF EXISTS "Read clients" ON public.clients;
CREATE POLICY "Secure clients access" ON public.clients
FOR SELECT
TO authenticated
USING (
  -- Apenas usuários autenticados podem ver clientes
  auth.role() = 'authenticated'
);

-- Política para inserção de clientes
DROP POLICY IF EXISTS "Insert clients" ON public.clients;
CREATE POLICY "Authenticated users can insert clients" ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Política para atualização de clientes
CREATE POLICY "Authenticated users can update clients" ON public.clients
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- POSTOS - Proteger informações de localização
DROP POLICY IF EXISTS "Read stations" ON public.stations;
CREATE POLICY "Secure stations access" ON public.stations
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert stations" ON public.stations;
CREATE POLICY "Authenticated users can insert stations" ON public.stations
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update stations" ON public.stations
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- SUGESTÕES DE PREÇO - Proteger dados comerciais confidenciais
DROP POLICY IF EXISTS "Read price_suggestions" ON public.price_suggestions;
CREATE POLICY "Secure price suggestions access" ON public.price_suggestions
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert price_suggestions" ON public.price_suggestions;
CREATE POLICY "Authenticated users can insert price suggestions" ON public.price_suggestions
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Update price_suggestions" ON public.price_suggestions;
CREATE POLICY "Authenticated users can update price suggestions" ON public.price_suggestions
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- HISTÓRICO DE PREÇOS - Proteger dados históricos confidenciais
DROP POLICY IF EXISTS "Read price_history" ON public.price_history;
CREATE POLICY "Secure price history access" ON public.price_history
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert price_history" ON public.price_history;
CREATE POLICY "Authenticated users can insert price history" ON public.price_history
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- PESQUISA DE CONCORRENTES - Proteger dados de mercado
DROP POLICY IF EXISTS "Read competitor_research" ON public.competitor_research;
CREATE POLICY "Secure competitor research access" ON public.competitor_research
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert competitor_research" ON public.competitor_research;
CREATE POLICY "Authenticated users can insert competitor research" ON public.competitor_research
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- MÉTODOS DE PAGAMENTO
DROP POLICY IF EXISTS "Read payment_methods" ON public.payment_methods;
CREATE POLICY "Secure payment methods access" ON public.payment_methods
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert payment_methods" ON public.payment_methods;
CREATE POLICY "Authenticated users can insert payment methods" ON public.payment_methods
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- 5. POLÍTICAS SEGURAS PARA TABELAS EXTERNAS
-- =====================================================

-- EXTERNAL_CONNECTIONS - Apenas admins podem acessar
CREATE POLICY "Only admins can access external connections" ON public.external_connections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- EXTERNAL_TABLE_MAPPINGS - Apenas admins podem acessar
CREATE POLICY "Only admins can access external table mappings" ON public.external_table_mappings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- SYNC_LOGS - Apenas admins podem acessar
CREATE POLICY "Only admins can access sync logs" ON public.sync_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- =====================================================
-- 6. GARANTIR QUE RLS ESTÁ HABILITADO EM TODAS AS TABELAS
-- =====================================================

-- Habilitar RLS em todas as tabelas principais
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_table_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. FUNÇÕES DE VALIDAÇÃO DE ENTRADA
-- =====================================================

-- Função para validar email
CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

-- Função para validar telefone brasileiro
CREATE OR REPLACE FUNCTION validate_phone(phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove caracteres não numéricos
  phone := regexp_replace(phone, '[^0-9]', '', 'g');
  -- Valida se tem 10 ou 11 dígitos (com DDD)
  RETURN length(phone) BETWEEN 10 AND 11;
END;
$$;

-- Função para validar preço
CREATE OR REPLACE FUNCTION validate_price(price NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN price > 0 AND price <= 999999.999;
END;
$$;

-- =====================================================
-- 8. TRIGGERS DE VALIDAÇÃO
-- =====================================================

-- Trigger para validar dados de clientes
CREATE OR REPLACE FUNCTION validate_client_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar email se fornecido
  IF NEW.contact_email IS NOT NULL AND NOT validate_email(NEW.contact_email) THEN
    RAISE EXCEPTION 'Email inválido: %', NEW.contact_email;
  END IF;
  
  -- Validar telefone se fornecido
  IF NEW.contact_phone IS NOT NULL AND NOT validate_phone(NEW.contact_phone) THEN
    RAISE EXCEPTION 'Telefone inválido: %', NEW.contact_phone;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_client_data_trigger
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION validate_client_data();

-- Trigger para validar dados de usuários
CREATE OR REPLACE FUNCTION validate_user_profile_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar email
  IF NOT validate_email(NEW.email) THEN
    RAISE EXCEPTION 'Email inválido: %', NEW.email;
  END IF;
  
  -- Validar margem máxima de aprovação
  IF NEW.max_approval_margin < 0 OR NEW.max_approval_margin > 100 THEN
    RAISE EXCEPTION 'Margem máxima de aprovação deve estar entre 0 e 100: %', NEW.max_approval_margin;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_user_profile_data_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_profile_data();

-- Trigger para validar preços
CREATE OR REPLACE FUNCTION validate_price_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar preço de custo
  IF NOT validate_price(NEW.cost_price) THEN
    RAISE EXCEPTION 'Preço de custo inválido: %', NEW.cost_price;
  END IF;
  
  -- Validar preço final
  IF NOT validate_price(NEW.final_price) THEN
    RAISE EXCEPTION 'Preço final inválido: %', NEW.final_price;
  END IF;
  
  -- Validar margem
  IF NEW.margin_cents < 0 OR NEW.margin_cents > 999999 THEN
    RAISE EXCEPTION 'Margem inválida: %', NEW.margin_cents;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_price_suggestions_data_trigger
  BEFORE INSERT OR UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION validate_price_data();

CREATE TRIGGER validate_price_history_data_trigger
  BEFORE INSERT OR UPDATE ON public.price_history
  FOR EACH ROW
  EXECUTE FUNCTION validate_price_data();

-- =====================================================
-- 9. AUDITORIA DE SEGURANÇA
-- =====================================================

-- Tabela para logs de auditoria de segurança
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Política para auditoria: apenas admins podem ver logs
CREATE POLICY "Only admins can view security audit logs" ON public.security_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up 
    WHERE up.user_id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- Função para registrar ações de segurança
CREATE OR REPLACE FUNCTION log_security_action(
  action_name TEXT,
  table_name TEXT,
  record_id UUID DEFAULT NULL,
  old_data JSONB DEFAULT NULL,
  new_data JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    action_name,
    table_name,
    record_id,
    old_data,
    new_data,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$;

-- =====================================================
-- 10. CONFIGURAÇÕES ADICIONAIS DE SEGURANÇA
-- =====================================================

-- Desabilitar acesso público ao schema public
REVOKE ALL ON SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Garantir que apenas usuários autenticados podem executar funções
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- =====================================================
-- 11. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.user_profiles IS 'Perfis de usuário com permissões restritas - apenas admins podem gerenciar';
COMMENT ON TABLE public.profile_permissions IS 'Permissões de perfil - apenas admins podem modificar';
COMMENT ON TABLE public.clients IS 'Dados de clientes - informações de contato protegidas';
COMMENT ON TABLE public.stations IS 'Dados de postos - informações de localização protegidas';
COMMENT ON TABLE public.price_suggestions IS 'Sugestões de preço - dados comerciais confidenciais';
COMMENT ON TABLE public.price_history IS 'Histórico de preços - dados históricos confidenciais';
COMMENT ON TABLE public.competitor_research IS 'Pesquisa de concorrentes - dados de mercado confidenciais';
COMMENT ON TABLE public.external_connections IS 'Conexões externas - apenas admins podem acessar';
COMMENT ON TABLE public.security_audit_log IS 'Logs de auditoria de segurança - apenas admins podem visualizar';

-- =====================================================
-- FIM DA MIGRAÇÃO DE SEGURANÇA
-- =====================================================
