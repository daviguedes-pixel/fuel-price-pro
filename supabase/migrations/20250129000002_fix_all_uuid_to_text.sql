-- Corrigir TODAS as colunas UUID para TEXT na tabela price_suggestions
-- Isso resolve o erro "invalid input syntax for type uuid"

-- Remover TODAS as foreign key constraints primeiro
ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_station_id_fkey,
  DROP CONSTRAINT IF EXISTS price_suggestions_client_id_fkey,
  DROP CONSTRAINT IF EXISTS price_suggestions_payment_method_id_fkey,
  DROP CONSTRAINT IF EXISTS price_suggestions_reference_id_fkey;

-- Converter TODAS as colunas UUID para TEXT
ALTER TABLE public.price_suggestions 
  ALTER COLUMN station_id TYPE TEXT USING station_id::TEXT,
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT,
  ALTER COLUMN payment_method_id TYPE TEXT USING payment_method_id::TEXT,
  ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_price_suggestions_station_id ON public.price_suggestions(station_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_client_id ON public.price_suggestions(client_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_payment_method_id ON public.price_suggestions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_reference_id ON public.price_suggestions(reference_id);

