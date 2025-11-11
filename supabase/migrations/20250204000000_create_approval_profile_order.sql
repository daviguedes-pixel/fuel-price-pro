-- Criação da tabela para armazenar a ordem de aprovação dos perfis
CREATE TABLE IF NOT EXISTS public.approval_profile_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil TEXT NOT NULL UNIQUE,
    order_position INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);

-- Índice para busca rápida por ordem
CREATE INDEX IF NOT EXISTS idx_approval_profile_order_position ON public.approval_profile_order(order_position) WHERE is_active = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_approval_profile_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_approval_profile_order_updated_at
    BEFORE UPDATE ON public.approval_profile_order
    FOR EACH ROW
    EXECUTE FUNCTION update_approval_profile_order_updated_at();

-- RLS Policies
ALTER TABLE public.approval_profile_order ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ler a ordem de aprovação
CREATE POLICY "Usuários autenticados podem ler ordem de aprovação"
    ON public.approval_profile_order
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Apenas admins podem modificar a ordem de aprovação
CREATE POLICY "Apenas admins podem modificar ordem de aprovação"
    ON public.approval_profile_order
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.profile_permissions pp ON up.perfil = pp.perfil
            WHERE up.user_id = auth.uid()
            AND pp.permissions ? 'admin'
        )
    );

-- Inserir ordem padrão se não existir
INSERT INTO public.approval_profile_order (perfil, order_position, is_active)
VALUES 
    ('supervisor_comercial', 1, true),
    ('diretor_comercial', 2, true),
    ('diretor_pricing', 3, true)
ON CONFLICT (perfil) DO NOTHING;

-- Comentários
COMMENT ON TABLE public.approval_profile_order IS 'Armazena a ordem hierárquica de aprovação dos perfis';
COMMENT ON COLUMN public.approval_profile_order.perfil IS 'Nome do perfil';
COMMENT ON COLUMN public.approval_profile_order.order_position IS 'Posição na ordem de aprovação (1 = primeiro, 2 = segundo, etc.)';
COMMENT ON COLUMN public.approval_profile_order.is_active IS 'Se o perfil está ativo na ordem de aprovação';

