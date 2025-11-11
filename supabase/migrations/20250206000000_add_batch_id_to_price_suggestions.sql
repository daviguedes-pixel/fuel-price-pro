-- Adicionar campo batch_id para identificar solicitações criadas juntas (em lote)
ALTER TABLE public.price_suggestions 
ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Criar índice para melhorar performance de queries por batch_id
CREATE INDEX IF NOT EXISTS idx_price_suggestions_batch_id ON public.price_suggestions(batch_id);

-- Comentário na coluna
COMMENT ON COLUMN public.price_suggestions.batch_id IS 'ID do lote - solicitações com o mesmo batch_id foram criadas juntas';

