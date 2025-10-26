-- Fix price_suggestions table structure
DO $$ 
BEGIN
  -- Adicionar coluna created_by se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'created_by') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN created_by TEXT;
  END IF;
  
  -- Adicionar coluna suggested_price se não existir (para compatibilidade com o frontend)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'suggested_price') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN suggested_price NUMERIC(10,3);
  END IF;
  
  -- Adicionar coluna current_price se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'current_price') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN current_price NUMERIC(10,3);
  END IF;
  
  -- Adicionar coluna arla_price se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'arla_price') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN arla_price NUMERIC(10,3);
  END IF;
  
  -- Renomear final_price para cost_price se necessário (para manter compatibilidade)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'price_suggestions' AND column_name = 'final_price') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'price_suggestions' AND column_name = 'cost_price') THEN
    ALTER TABLE public.price_suggestions RENAME COLUMN final_price TO cost_price;
  END IF;
END $$;

-- Garantir que a tabela referencias tem a coluna anexo para imagens
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'referencias' AND column_name = 'anexo') THEN
    ALTER TABLE public.referencias ADD COLUMN anexo TEXT[];
  END IF;
END $$;

-- Dados de exemplo removidos - usar apenas dados reais

-- Dados de exemplo de referências removidos - usar apenas dados reais
