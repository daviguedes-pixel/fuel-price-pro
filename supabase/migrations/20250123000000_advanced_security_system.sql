-- =====================================================
-- SISTEMA DE SEGURANÇA AVANÇADO - FUEL PRICE PRO
-- =====================================================
-- Este arquivo implementa:
-- 1. Sistema JWT personalizado
-- 2. Rate limiting no banco
-- 3. Validação avançada de dados
-- 4. Logs de segurança detalhados
-- 5. Políticas RLS reforçadas

-- =====================================================
-- 1. TABELAS DE SEGURANÇA
-- =====================================================

-- Tabela para logs de segurança detalhados
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    method TEXT,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para eventos de segurança críticos
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    details JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para controle de rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    ip_address INET NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para sessões ativas
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- 2. FUNÇÕES DE VALIDAÇÃO AVANÇADA
-- =====================================================

-- Função para validar email com regex
CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar telefone brasileiro
CREATE OR REPLACE FUNCTION validate_phone(phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove caracteres não numéricos
    phone := regexp_replace(phone, '[^0-9]', '', 'g');
    -- Valida se tem 10 ou 11 dígitos
    RETURN length(phone) BETWEEN 10 AND 11;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar preço
CREATE OR REPLACE FUNCTION validate_price(price DECIMAL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN price > 0 AND price <= 999999.99;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar CNPJ
CREATE OR REPLACE FUNCTION validate_cnpj(cnpj TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    cnpj_clean TEXT;
    weights1 INTEGER[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
    weights2 INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
    sum1 INTEGER := 0;
    sum2 INTEGER := 0;
    digit1 INTEGER;
    digit2 INTEGER;
BEGIN
    -- Remove caracteres não numéricos
    cnpj_clean := regexp_replace(cnpj, '[^0-9]', '', 'g');
    
    -- Verifica se tem 14 dígitos
    IF length(cnpj_clean) != 14 THEN
        RETURN FALSE;
    END IF;
    
    -- Verifica se não são todos os dígitos iguais
    IF cnpj_clean ~ '^(\d)\1+$' THEN
        RETURN FALSE;
    END IF;
    
    -- Calcula primeiro dígito verificador
    FOR i IN 1..12 LOOP
        sum1 := sum1 + (substring(cnpj_clean, i, 1)::INTEGER * weights1[i]);
    END LOOP;
    
    digit1 := CASE WHEN sum1 % 11 < 2 THEN 0 ELSE 11 - (sum1 % 11) END;
    
    -- Calcula segundo dígito verificador
    FOR i IN 1..13 LOOP
        sum2 := sum2 + (substring(cnpj_clean, i, 1)::INTEGER * weights2[i]);
    END LOOP;
    
    digit2 := CASE WHEN sum2 % 11 < 2 THEN 0 ELSE 11 - (sum2 % 11) END;
    
    -- Verifica se os dígitos calculados coincidem com os fornecidos
    RETURN digit1 = substring(cnpj_clean, 13, 1)::INTEGER AND 
           digit2 = substring(cnpj_clean, 14, 1)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. FUNÇÕES DE SEGURANÇA
-- =====================================================

-- Função para verificar rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_endpoint TEXT,
    p_ip_address INET,
    p_max_requests INTEGER DEFAULT 100,
    p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
    request_count INTEGER;
    window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
    
    -- Conta requisições no período
    SELECT COALESCE(SUM(request_count), 0) INTO request_count
    FROM rate_limit_log
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint
      AND ip_address = p_ip_address
      AND window_start >= window_start;
    
    -- Se excedeu o limite, registra bloqueio
    IF request_count >= p_max_requests THEN
        INSERT INTO rate_limit_log (user_id, endpoint, ip_address, request_count, blocked)
        VALUES (p_user_id, p_endpoint, p_ip_address, 1, true);
        
        -- Registra evento de segurança
        INSERT INTO security_events (event_type, severity, description, user_id, ip_address)
        VALUES ('rate_limit_exceeded', 'medium', 
               'Rate limit exceeded for endpoint: ' || p_endpoint, 
               p_user_id, p_ip_address);
        
        RETURN FALSE;
    END IF;
    
    -- Registra a requisição
    INSERT INTO rate_limit_log (user_id, endpoint, ip_address)
    VALUES (p_user_id, p_endpoint, p_ip_address);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar token JWT personalizado
CREATE OR REPLACE FUNCTION generate_custom_jwt(
    p_user_id UUID,
    p_claims JSONB DEFAULT '{}'::JSONB
)
RETURNS TEXT AS $$
DECLARE
    header JSONB;
    payload JSONB;
    secret TEXT;
    header_encoded TEXT;
    payload_encoded TEXT;
    signature TEXT;
    token TEXT;
BEGIN
    secret := current_setting('app.jwt_secret', true);
    
    IF secret IS NULL OR secret = '' THEN
        secret := 'default-secret-key-change-in-production';
    END IF;
    
    -- Header
    header := '{"alg":"HS256","typ":"JWT"}'::JSONB;
    header_encoded := encode(convert_to(header::TEXT, 'UTF8'), 'base64');
    
    -- Payload
    payload := jsonb_build_object(
        'sub', p_user_id::TEXT,
        'iat', extract(epoch from now()),
        'exp', extract(epoch from now() + interval '24 hours'),
        'iss', 'fuel-price-pro',
        'aud', 'fuel-price-pro-users'
    ) || p_claims;
    
    payload_encoded := encode(convert_to(payload::TEXT, 'UTF8'), 'base64');
    
    -- Signature (simplified - em produção usar biblioteca JWT adequada)
    signature := encode(hmac(header_encoded || '.' || payload_encoded, secret, 'sha256'), 'base64');
    
    token := header_encoded || '.' || payload_encoded || '.' || signature;
    
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar token JWT personalizado
CREATE OR REPLACE FUNCTION verify_custom_jwt(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    parts TEXT[];
    header JSONB;
    payload JSONB;
    signature TEXT;
    expected_signature TEXT;
    secret TEXT;
    current_time BIGINT;
BEGIN
    secret := current_setting('app.jwt_secret', true);
    
    IF secret IS NULL OR secret = '' THEN
        secret := 'default-secret-key-change-in-production';
    END IF;
    
    -- Divide o token
    parts := string_to_array(p_token, '.');
    
    IF array_length(parts, 1) != 3 THEN
        RETURN '{"valid": false, "error": "Invalid token format"}'::JSONB;
    END IF;
    
    -- Decodifica header e payload
    BEGIN
        header := convert_from(decode(parts[1], 'base64'), 'UTF8')::JSONB;
        payload := convert_from(decode(parts[2], 'base64'), 'UTF8')::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN '{"valid": false, "error": "Invalid token encoding"}'::JSONB;
    END;
    
    -- Verifica expiração
    current_time := extract(epoch from now());
    IF (payload->>'exp')::BIGINT < current_time THEN
        RETURN '{"valid": false, "error": "Token expired"}'::JSONB;
    END IF;
    
    -- Verifica assinatura
    expected_signature := encode(hmac(parts[1] || '.' || parts[2], secret, 'sha256'), 'base64');
    
    IF parts[3] != expected_signature THEN
        RETURN '{"valid": false, "error": "Invalid signature"}'::JSONB;
    END IF;
    
    RETURN jsonb_build_object(
        'valid', true,
        'user_id', payload->>'sub',
        'claims', payload
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGERS DE SEGURANÇA
-- =====================================================

-- Trigger para log automático de modificações
CREATE OR REPLACE FUNCTION log_security_changes()
RETURNS TRIGGER AS $$
DECLARE
    operation TEXT;
    old_data JSONB;
    new_data JSONB;
BEGIN
    operation := TG_OP;
    
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
    END IF;
    
    INSERT INTO security_audit_log (
        user_id,
        action,
        resource,
        details,
        severity
    ) VALUES (
        COALESCE(NEW.user_id, OLD.user_id, auth.uid()),
        operation,
        TG_TABLE_NAME,
        jsonb_build_object(
            'old_data', old_data,
            'new_data', new_data,
            'table', TG_TABLE_NAME,
            'operation', operation
        ),
        CASE 
            WHEN TG_TABLE_NAME IN ('user_profiles', 'security_events') THEN 'high'
            WHEN TG_TABLE_NAME IN ('price_suggestions', 'competitor_research') THEN 'medium'
            ELSE 'low'
        END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers em tabelas críticas
DROP TRIGGER IF EXISTS user_profiles_security_log ON public.user_profiles;
CREATE TRIGGER user_profiles_security_log
    AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION log_security_changes();

DROP TRIGGER IF EXISTS price_suggestions_security_log ON public.price_suggestions;
CREATE TRIGGER price_suggestions_security_log
    AFTER INSERT OR UPDATE OR DELETE ON public.price_suggestions
    FOR EACH ROW EXECUTE FUNCTION log_security_changes();

DROP TRIGGER IF EXISTS competitor_research_security_log ON public.competitor_research;
CREATE TRIGGER competitor_research_security_log
    AFTER INSERT OR UPDATE OR DELETE ON public.competitor_research
    FOR EACH ROW EXECUTE FUNCTION log_security_changes();

-- =====================================================
-- 5. POLÍTICAS RLS REFORÇADAS
-- =====================================================

-- Habilitar RLS em todas as tabelas de segurança
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para security_audit_log (apenas admins)
CREATE POLICY "Only admins can view audit logs" ON public.security_audit_log
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() 
        AND up.role = 'admin'
    )
);

-- Políticas para security_events (apenas admins)
CREATE POLICY "Only admins can view security events" ON public.security_events
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() 
        AND up.role = 'admin'
    )
);

-- Políticas para rate_limit_log (apenas sistema)
CREATE POLICY "System can manage rate limit logs" ON public.rate_limit_log
FOR ALL TO authenticated
USING (false); -- Apenas funções do sistema podem acessar

-- Políticas para active_sessions (usuário pode ver suas próprias sessões)
CREATE POLICY "Users can view own sessions" ON public.active_sessions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions" ON public.active_sessions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 6. FUNÇÕES DE LIMPEZA AUTOMÁTICA
-- =====================================================

-- Função para limpar logs antigos
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS VOID AS $$
BEGIN
    -- Remove logs de auditoria mais antigos que 90 dias
    DELETE FROM security_audit_log 
    WHERE created_at < now() - interval '90 days';
    
    -- Remove logs de rate limiting mais antigos que 7 dias
    DELETE FROM rate_limit_log 
    WHERE created_at < now() - interval '7 days';
    
    -- Remove sessões expiradas
    DELETE FROM active_sessions 
    WHERE expires_at < now();
    
    -- Remove eventos de segurança resolvidos há mais de 30 dias
    DELETE FROM security_events 
    WHERE resolved = true 
    AND resolved_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CONFIGURAÇÕES DE SEGURANÇA
-- =====================================================

-- Configurar JWT secret (em produção, definir via variável de ambiente)
ALTER DATABASE postgres SET app.jwt_secret = 'fuel-price-pro-secret-key-change-in-production';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON public.security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_endpoint ON public.rate_limit_log(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON public.active_sessions(expires_at);

-- =====================================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.security_audit_log IS 'Logs detalhados de auditoria de segurança';
COMMENT ON TABLE public.security_events IS 'Eventos críticos de segurança';
COMMENT ON TABLE public.rate_limit_log IS 'Controle de rate limiting por usuário e endpoint';
COMMENT ON TABLE public.active_sessions IS 'Sessões ativas de usuários';

COMMENT ON FUNCTION validate_email(TEXT) IS 'Valida formato de email com regex';
COMMENT ON FUNCTION validate_phone(TEXT) IS 'Valida telefone brasileiro (10-11 dígitos)';
COMMENT ON FUNCTION validate_price(DECIMAL) IS 'Valida preços entre 0 e 999999.99';
COMMENT ON FUNCTION validate_cnpj(TEXT) IS 'Valida CNPJ com algoritmo de dígitos verificadores';
COMMENT ON FUNCTION check_rate_limit(UUID, TEXT, INET, INTEGER, INTEGER) IS 'Verifica e aplica rate limiting';
COMMENT ON FUNCTION generate_custom_jwt(UUID, JSONB) IS 'Gera token JWT personalizado';
COMMENT ON FUNCTION verify_custom_jwt(TEXT) IS 'Verifica e decodifica token JWT';
COMMENT ON FUNCTION log_security_changes() IS 'Trigger para log automático de mudanças';
COMMENT ON FUNCTION cleanup_old_logs() IS 'Limpa logs antigos automaticamente';

-- =====================================================
-- 9. GRANTS E PERMISSÕES
-- =====================================================

-- Conceder permissões para funções de segurança
GRANT EXECUTE ON FUNCTION validate_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_phone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_price(DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_cnpj(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_custom_jwt(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_custom_jwt(TEXT) TO authenticated;

-- Conceder permissões para tabelas de segurança
GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT SELECT ON public.security_events TO authenticated;
GRANT SELECT ON public.active_sessions TO authenticated;

-- =====================================================
-- SISTEMA DE SEGURANÇA IMPLEMENTADO COM SUCESSO
-- =====================================================
