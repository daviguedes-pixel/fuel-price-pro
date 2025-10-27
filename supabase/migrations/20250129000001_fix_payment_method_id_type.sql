-- Alterar payment_method_id para aceitar TEXT (UUID, ID numérico ou CARTAO)
-- Primeiro, remover a constraint de foreign key
ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_payment_method_id_fkey;

-- Converter a coluna para TEXT
ALTER TABLE public.price_suggestions 
  ALTER COLUMN payment_method_id TYPE TEXT USING 
    CASE 
      WHEN payment_method_id IS NULL THEN NULL
      ELSE payment_method_id::TEXT
    END;

