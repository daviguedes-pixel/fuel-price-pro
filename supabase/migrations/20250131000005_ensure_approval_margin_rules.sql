-- Garantir que a tabela approval_margin_rules existe
-- Esta migração verifica se a tabela já existe antes de criar

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS public.approval_margin_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_margin_cents INTEGER NOT NULL,
    max_margin_cents INTEGER,
    required_profiles TEXT[] NOT NULL,
    rule_name TEXT,
    is_active BOOLEAN DEFAULT true,
    priority_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    CONSTRAINT valid_margin_range CHECK (max_margin_cents IS NULL OR max_margin_cents >= min_margin_cents),
    CONSTRAINT valid_profiles CHECK (array_length(required_profiles, 1) > 0)
);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_approval_margin_rules_margin ON public.approval_margin_rules(min_margin_cents, max_margin_cents);
CREATE INDEX IF NOT EXISTS idx_approval_margin_rules_active ON public.approval_margin_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_approval_margin_rules_priority ON public.approval_margin_rules(priority_order DESC);

-- Criar função de trigger se não existir
CREATE OR REPLACE FUNCTION update_approval_margin_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_update_approval_margin_rules_updated_at ON public.approval_margin_rules;
CREATE TRIGGER trigger_update_approval_margin_rules_updated_at
    BEFORE UPDATE ON public.approval_margin_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_approval_margin_rules_updated_at();

-- Habilitar RLS
ALTER TABLE public.approval_margin_rules ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can read active approval margin rules" ON public.approval_margin_rules;
DROP POLICY IF EXISTS "Admins can manage approval margin rules" ON public.approval_margin_rules;

-- Criar políticas RLS
CREATE POLICY "Users can read active approval margin rules"
    ON public.approval_margin_rules
    FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Admins can manage approval margin rules"
    ON public.approval_margin_rules
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

-- Criar ou substituir função para buscar regra de aprovação
CREATE OR REPLACE FUNCTION public.get_approval_margin_rule(margin_cents INTEGER)
RETURNS TABLE (
    id UUID,
    min_margin_cents INTEGER,
    max_margin_cents INTEGER,
    required_profiles TEXT[],
    rule_name TEXT,
    priority_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.min_margin_cents,
        r.max_margin_cents,
        r.required_profiles,
        r.rule_name,
        r.priority_order
    FROM public.approval_margin_rules r
    WHERE r.is_active = true
        AND r.min_margin_cents <= margin_cents
        AND (r.max_margin_cents IS NULL OR r.max_margin_cents >= margin_cents)
    ORDER BY r.priority_order DESC, r.min_margin_cents DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inserir regra padrão se não existir
INSERT INTO public.approval_margin_rules (
    min_margin_cents,
    max_margin_cents,
    required_profiles,
    rule_name,
    is_active,
    priority_order
)
SELECT
    0,
    34,
    ARRAY['diretor_comercial', 'diretor_pricing'],
    'Margem baixa - requer aprovação de diretores',
    true,
    100
WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_margin_rules 
    WHERE rule_name = 'Margem baixa - requer aprovação de diretores'
);

-- Comentários para documentação
COMMENT ON TABLE public.approval_margin_rules IS 'Regras de aprovação baseadas em margem de lucro';
COMMENT ON COLUMN public.approval_margin_rules.min_margin_cents IS 'Margem mínima em centavos para aplicar esta regra';
COMMENT ON COLUMN public.approval_margin_rules.max_margin_cents IS 'Margem máxima em centavos (NULL = sem limite superior)';
COMMENT ON COLUMN public.approval_margin_rules.required_profiles IS 'Array de perfis que devem aprovar quando a margem está neste intervalo';
COMMENT ON COLUMN public.approval_margin_rules.priority_order IS 'Ordem de prioridade (maior número = maior prioridade)';


