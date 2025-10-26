-- Alterar a tabela referencias para usar os IDs das tabelas antigas
-- Primeiro remover as constraints de chave estrangeira se existirem
ALTER TABLE public.referencias 
  DROP CONSTRAINT IF EXISTS referencias_posto_id_fkey,
  DROP CONSTRAINT IF EXISTS referencias_cliente_id_fkey;

-- Alterar os tipos de coluna de UUID para TEXT para aceitar CNPJs e IDs numéricos
ALTER TABLE public.referencias 
  ALTER COLUMN posto_id TYPE TEXT USING posto_id::TEXT,
  ALTER COLUMN cliente_id TYPE TEXT USING cliente_id::TEXT;

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_referencias_posto_id ON public.referencias(posto_id);
CREATE INDEX IF NOT EXISTS idx_referencias_cliente_id ON public.referencias(cliente_id);