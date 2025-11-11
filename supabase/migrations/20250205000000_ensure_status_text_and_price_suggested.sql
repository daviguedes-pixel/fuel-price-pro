-- Garantir que a coluna status seja TEXT e permitir valor 'price_suggested'
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
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_suggestions' 
    AND column_name = 'status'
    AND table_schema = 'public'
    AND data_type = 'text'
  ) THEN
    -- Já é TEXT, apenas garantir que não há constraints restritivas
    RAISE NOTICE '✅ Coluna status já é TEXT';
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

-- Remover qualquer constraint CHECK que possa estar restringindo valores
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Buscar constraints CHECK na coluna status
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.price_suggestions'::regclass
        AND contype = 'c'
        AND conname LIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.price_suggestions DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '✅ Constraint removida: %', constraint_name;
    END LOOP;
END $$;

-- Criar índice para melhor performance (se não existir)
CREATE INDEX IF NOT EXISTS idx_price_suggestions_status ON public.price_suggestions(status);

-- Comentário na coluna
COMMENT ON COLUMN public.price_suggestions.status IS 'Status da solicitação: pending, approved, rejected, draft, price_suggested';

