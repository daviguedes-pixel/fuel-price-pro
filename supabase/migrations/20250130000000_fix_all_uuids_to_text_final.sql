-- MIGRAÇÃO FINAL: Converter TODAS as colunas ID para TEXT na tabela price_suggestions
-- Esta migração resolve o erro "invalid input syntax for type uuid" de uma vez por todas

-- 1. Remover TODAS as foreign key constraints que usam UUID
ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_station_id_fkey;

ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_client_id_fkey;

ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_payment_method_id_fkey;

ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_reference_id_fkey;

-- 2. Converter TODAS as colunas ID para TEXT
-- Isso permite salvar qualquer tipo de ID (UUID, números, CNPJ, etc)
ALTER TABLE public.price_suggestions 
  ALTER COLUMN station_id TYPE TEXT USING 
    CASE 
      WHEN station_id IS NULL THEN NULL
      ELSE station_id::TEXT
    END;

ALTER TABLE public.price_suggestions 
  ALTER COLUMN client_id TYPE TEXT USING 
    CASE 
      WHEN client_id IS NULL THEN NULL
      ELSE client_id::TEXT
    END;

ALTER TABLE public.price_suggestions 
  ALTER COLUMN payment_method_id TYPE TEXT USING 
    CASE 
      WHEN payment_method_id IS NULL THEN NULL
      ELSE payment_method_id::TEXT
    END;

ALTER TABLE public.price_suggestions 
  ALTER COLUMN reference_id TYPE TEXT USING 
    CASE 
      WHEN reference_id IS NULL THEN NULL
      ELSE reference_id::TEXT
    END;

-- 3. Criar índices para melhor performance (sem foreign keys)
CREATE INDEX IF NOT EXISTS idx_price_suggestions_station_id ON public.price_suggestions(station_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_client_id ON public.price_suggestions(client_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_payment_method_id ON public.price_suggestions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_reference_id ON public.price_suggestions(reference_id);

-- 4. Log da migração
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migração aplicada: TODAS as colunas ID convertidas para TEXT';
  RAISE NOTICE '✅ Foreign keys removidas';
  RAISE NOTICE '✅ Índices criados para melhor performance';
END $$;

