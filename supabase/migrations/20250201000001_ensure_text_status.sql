-- Garantir que a coluna status seja TEXT (não ENUM) para evitar conflitos
DO $$ 
BEGIN
  -- Verificar se a coluna status existe e qual é o tipo
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'status'
    AND table_schema = 'public'
    AND data_type = 'USER-DEFINED'
  ) THEN
    -- Converter ENUM para TEXT
    ALTER TABLE public.price_suggestions 
      ALTER COLUMN status TYPE TEXT USING status::TEXT;
    
    RAISE NOTICE '✅ Coluna status convertida de ENUM para TEXT';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'status'
    AND table_schema = 'public'
  ) THEN
    -- Criar coluna se não existir
    ALTER TABLE public.price_suggestions 
      ADD COLUMN status TEXT DEFAULT 'pending';
    
    RAISE NOTICE '✅ Coluna status criada como TEXT';
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_price_suggestions_status ON public.price_suggestions(status);


