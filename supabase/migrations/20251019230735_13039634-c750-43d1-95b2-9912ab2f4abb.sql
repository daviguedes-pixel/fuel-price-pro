-- Criar tabela para histórico de aprovações
CREATE TABLE IF NOT EXISTS public.approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.price_suggestions(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES auth.users(id),
  approver_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
  observations TEXT,
  approval_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar campos de cálculo e aprovação multinível na tabela price_suggestions
ALTER TABLE public.price_suggestions 
ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC,
ADD COLUMN IF NOT EXISTS freight_cost NUMERIC,
ADD COLUMN IF NOT EXISTS volume_made NUMERIC,
ADD COLUMN IF NOT EXISTS volume_projected NUMERIC,
ADD COLUMN IF NOT EXISTS arla_purchase_price NUMERIC,
ADD COLUMN IF NOT EXISTS arla_cost_price NUMERIC,
ADD COLUMN IF NOT EXISTS current_approver_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS current_approver_name TEXT,
ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_approvers INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS approvals_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rejections_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_origin_base TEXT,
ADD COLUMN IF NOT EXISTS price_origin_code TEXT,
ADD COLUMN IF NOT EXISTS price_origin_uf TEXT,
ADD COLUMN IF NOT EXISTS price_origin_delivery TEXT;

-- Habilitar RLS na tabela approval_history
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

-- Política para visualizar histórico
CREATE POLICY "Users can view approval history"
ON public.approval_history
FOR SELECT
TO authenticated
USING (true);

-- Política para inserir no histórico
CREATE POLICY "Users can insert approval history"
ON public.approval_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = approver_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_approval_history_updated_at
BEFORE UPDATE ON public.approval_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_approval_history_suggestion_id ON public.approval_history(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_approver_id ON public.approval_history(approver_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_current_approver ON public.price_suggestions(current_approver_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_status ON public.price_suggestions(status);

COMMENT ON TABLE public.approval_history IS 'Histórico de aprovações/rejeições com observações de cada aprovador';
COMMENT ON COLUMN public.price_suggestions.current_approver_id IS 'ID do aprovador atual no fluxo';
COMMENT ON COLUMN public.price_suggestions.approval_level IS 'Nível atual de aprovação (1, 2, 3...)';
COMMENT ON COLUMN public.price_suggestions.approvals_count IS 'Quantos aprovadores aprovaram';
COMMENT ON COLUMN public.price_suggestions.rejections_count IS 'Quantos aprovadores rejeitaram';