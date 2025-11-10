-- Criar tabela para armazenar a ordem de aprovação por perfil
CREATE TABLE IF NOT EXISTS public.approval_profile_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil TEXT NOT NULL UNIQUE,
    order_position INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_perfil CHECK (perfil IS NOT NULL AND perfil != '')
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_approval_profile_order_position ON public.approval_profile_order(order_position);
CREATE INDEX IF NOT EXISTS idx_approval_profile_order_active ON public.approval_profile_order(is_active) WHERE is_active = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_approval_profile_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_approval_profile_order_updated_at ON public.approval_profile_order;
CREATE TRIGGER trigger_update_approval_profile_order_updated_at
    BEFORE UPDATE ON public.approval_profile_order
    FOR EACH ROW
    EXECUTE FUNCTION update_approval_profile_order_updated_at();

-- Habilitar RLS
ALTER TABLE public.approval_profile_order ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can read approval profile order" ON public.approval_profile_order;
DROP POLICY IF EXISTS "Admins can manage approval profile order" ON public.approval_profile_order;

-- Política: Usuários autenticados podem ler a ordem
CREATE POLICY "Users can read approval profile order"
    ON public.approval_profile_order
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Política: Apenas admins podem gerenciar a ordem
CREATE POLICY "Admins can manage approval profile order"
    ON public.approval_profile_order
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.user_id::text = auth.uid()::text
            AND (up.role = 'admin' OR up.email = 'davi.guedes@redesaoroque.com.br')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.user_id::text = auth.uid()::text
            AND (up.role = 'admin' OR up.email = 'davi.guedes@redesaoroque.com.br')
        )
    );

-- Função para obter a ordem de aprovação
CREATE OR REPLACE FUNCTION public.get_approval_profile_order()
RETURNS TABLE (
    perfil TEXT,
    order_position INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        apo.perfil,
        apo.order_position
    FROM public.approval_profile_order apo
    WHERE apo.is_active = true
    ORDER BY apo.order_position ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserir ordem padrão se não existir
INSERT INTO public.approval_profile_order (perfil, order_position, is_active)
SELECT * FROM (VALUES
    ('supervisor_comercial', 1, true),
    ('diretor_comercial', 2, true),
    ('diretor_pricing', 3, true)
) AS v(perfil, order_position, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_profile_order WHERE perfil = v.perfil
);

-- Comentários
COMMENT ON TABLE public.approval_profile_order IS 'Ordem hierárquica de aprovação por perfil';
COMMENT ON COLUMN public.approval_profile_order.perfil IS 'Nome do perfil';
COMMENT ON COLUMN public.approval_profile_order.order_position IS 'Posição na ordem de aprovação (menor número = aprova primeiro)';

