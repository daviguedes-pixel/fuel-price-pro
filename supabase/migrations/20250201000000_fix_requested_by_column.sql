-- Corrigir tipo da coluna requested_by para TEXT
-- Isso garante que funcione tanto com UUID quanto com email ou outro identificador

DO $$ 
BEGIN
  -- Verificar se a coluna existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'requested_by'
    AND table_schema = 'public'
    AND data_type = 'uuid'
  ) THEN
    -- Converter UUID para TEXT
    ALTER TABLE public.price_suggestions 
      ALTER COLUMN requested_by TYPE TEXT USING requested_by::TEXT;
    
    RAISE NOTICE '✅ Coluna requested_by convertida de UUID para TEXT';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'requested_by'
    AND table_schema = 'public'
    AND data_type = 'text'
  ) THEN
    RAISE NOTICE '✅ Coluna requested_by já está como TEXT';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'requested_by'
    AND table_schema = 'public'
  ) THEN
    -- Criar coluna se não existir
    ALTER TABLE public.price_suggestions 
      ADD COLUMN requested_by TEXT;
    
    RAISE NOTICE '✅ Coluna requested_by criada como TEXT';
  END IF;
END $$;

-- Garantir que created_by também seja TEXT (já que não usamos foreign keys)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'created_by'
    AND table_schema = 'public'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.price_suggestions 
      ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
    
    RAISE NOTICE '✅ Coluna created_by convertida de UUID para TEXT';
  END IF;
END $$;

-- Garantir que approved_by também seja TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'approved_by'
    AND table_schema = 'public'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.price_suggestions 
      ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT;
    
    RAISE NOTICE '✅ Coluna approved_by convertida de UUID para TEXT';
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_price_suggestions_requested_by ON public.price_suggestions(requested_by);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_created_by ON public.price_suggestions(created_by);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_approved_by ON public.price_suggestions(approved_by);


