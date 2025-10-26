-- Criação do sistema de permissões completo
CREATE TYPE public.user_role AS ENUM ('admin', 'supervisor', 'analista', 'gerente');

-- Tabela de perfis de usuário com permissões detalhadas
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    cargo TEXT,
    role public.user_role NOT NULL DEFAULT 'analista'::user_role,
    senha_temporaria BOOLEAN DEFAULT true,
    margem_maxima_aprovacao DECIMAL(5,2) DEFAULT 0.00,
    -- Permissões específicas
    pode_acessar_solicitacao BOOLEAN DEFAULT true,
    pode_acessar_aprovacao BOOLEAN DEFAULT false,
    pode_acessar_pesquisa BOOLEAN DEFAULT true,
    pode_acessar_mapa BOOLEAN DEFAULT true,
    pode_acessar_historico BOOLEAN DEFAULT true,
    pode_acessar_admin BOOLEAN DEFAULT false,
    pode_acessar_cadastro_referencia BOOLEAN DEFAULT false,
    pode_acessar_cadastro_taxas BOOLEAN DEFAULT false,
    pode_acessar_cadastro_clientes BOOLEAN DEFAULT false,
    pode_acessar_cadastro_postos BOOLEAN DEFAULT false,
    pode_aprovar_direto BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Política para visualizar próprio perfil ou admins verem todos
CREATE POLICY "Users can view own profile or admins view all" 
ON public.user_profiles 
FOR SELECT 
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
);

-- Política para admins atualizarem perfis
CREATE POLICY "Admins can update profiles" 
ON public.user_profiles 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() AND up.role = 'admin'
    )
);

-- Política para usuários atualizarem própria senha
CREATE POLICY "Users can update own password status" 
ON public.user_profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Tabela de referências para solicitações de preço
CREATE TABLE public.referencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_referencia TEXT UNIQUE NOT NULL,
    posto_id UUID REFERENCES public.stations(id) NOT NULL,
    cliente_id UUID REFERENCES public.clients(id) NOT NULL,
    produto public.product_type NOT NULL,
    preco_referencia DECIMAL(10,2) NOT NULL,
    tipo_pagamento_id UUID REFERENCES public.payment_methods(id),
    observacoes TEXT,
    anexo TEXT,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;

-- Política para todos verem referências
CREATE POLICY "All authenticated users can view references" 
ON public.referencias 
FOR SELECT 
USING (true);

-- Política para usuários com permissão criarem referências
CREATE POLICY "Users with permission can create references" 
ON public.referencias 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() AND up.pode_acessar_cadastro_referencia = true
    )
);

-- Tabela de taxas negociadas
CREATE TABLE public.taxas_negociadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clients(id) NOT NULL,
    posto_id UUID REFERENCES public.stations(id) NOT NULL,
    tipo_pagamento_id UUID REFERENCES public.payment_methods(id) NOT NULL,
    taxa_percentual DECIMAL(5,2) NOT NULL,
    taxa_negociada BOOLEAN DEFAULT false,
    anexo_email TEXT,
    data_taxa DATE DEFAULT CURRENT_DATE,
    data_vencimento DATE,
    notificacao_enviada BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(cliente_id, posto_id, tipo_pagamento_id)
);

-- Enable RLS
ALTER TABLE public.taxas_negociadas ENABLE ROW LEVEL SECURITY;

-- Política para todos verem taxas
CREATE POLICY "All authenticated users can view rates" 
ON public.taxas_negociadas 
FOR SELECT 
USING (true);

-- Política para usuários com permissão gerenciarem taxas
CREATE POLICY "Users with permission can manage rates" 
ON public.taxas_negociadas 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() AND up.pode_acessar_cadastro_taxas = true
    )
);

-- Tabela de logs de auditoria
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    acao TEXT NOT NULL,
    tabela TEXT,
    registro_id UUID,
    dados_antigos JSONB,
    dados_novos JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para admins e supervisores verem logs
CREATE POLICY "Admins and supervisors can view logs" 
ON public.audit_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.user_id = auth.uid() AND up.role IN ('admin', 'supervisor')
    )
);

-- Atualizar tabela de price_suggestions para incluir referência
ALTER TABLE public.price_suggestions 
ADD COLUMN referencia_id UUID REFERENCES public.referencias(id),
ADD COLUMN preco_desejado DECIMAL(10,2),
ADD COLUMN aprovado_automaticamente BOOLEAN DEFAULT false,
ADD COLUMN margem_calculada DECIMAL(5,2);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_referencias_updated_at
    BEFORE UPDATE ON public.referencias
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_taxas_negociadas_updated_at
    BEFORE UPDATE ON public.taxas_negociadas
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Função para gerar código de referência
CREATE OR REPLACE FUNCTION public.generate_reference_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'REF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('reference_sequence')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Sequence para códigos de referência
CREATE SEQUENCE IF NOT EXISTS reference_sequence START 1;

-- Trigger para gerar código automaticamente
CREATE OR REPLACE FUNCTION public.set_reference_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo_referencia IS NULL THEN
        NEW.codigo_referencia = public.generate_reference_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_referencias_code
    BEFORE INSERT ON public.referencias
    FOR EACH ROW
    EXECUTE FUNCTION public.set_reference_code();

-- Função para registrar logs de auditoria
CREATE OR REPLACE FUNCTION public.log_audit_action(
    p_acao TEXT,
    p_tabela TEXT DEFAULT NULL,
    p_registro_id UUID DEFAULT NULL,
    p_dados_antigos JSONB DEFAULT NULL,
    p_dados_novos JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, acao, tabela, registro_id, dados_antigos, dados_novos)
    VALUES (auth.uid(), p_acao, p_tabela, p_registro_id, p_dados_antigos, p_dados_novos);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserir perfis para usuários existentes (senha padrão deve ser alterada via auth)
INSERT INTO public.user_profiles (user_id, email, nome, cargo, role, pode_acessar_aprovacao, pode_acessar_admin, margem_maxima_aprovacao, pode_aprovar_direto, pode_acessar_cadastro_referencia, pode_acessar_cadastro_taxas, pode_acessar_cadastro_clientes, pode_acessar_cadastro_postos)
VALUES 
-- Admin principal
((SELECT id FROM auth.users WHERE email = 'jandson@redesaoroque.com.br' LIMIT 1), 'jandson@redesaoroque.com.br', 'Jandson', 'Diretor Comercial', 'admin', true, true, 999.99, true, true, true, true, true),
-- Supervisor
((SELECT id FROM auth.users WHERE email = 'matheus.sousa@redesaoroque.com.br' LIMIT 1), 'matheus.sousa@redesaoroque.com.br', 'Matheus Sousa', 'Supervisor Comercial', 'supervisor', true, false, 50.00, true, true, true, false, false),
-- Diretor de Pricing
((SELECT id FROM auth.users WHERE email = 'cayo.melo@redesaoroque.com.br' LIMIT 1), 'cayo.melo@redesaoroque.com.br', 'Cayo Melo', 'Diretor de Pricing', 'admin', true, true, 999.99, true, true, true, true, true),
-- Analista
((SELECT id FROM auth.users WHERE email = 'davi.guedes@redesaoroque.com.br' LIMIT 1), 'davi.guedes@redesaoroque.com.br', 'Davi Guedes', 'Analista de Pricing', 'analista', false, false, 10.00, false, false, false, false, false)
ON CONFLICT (user_id) DO NOTHING;