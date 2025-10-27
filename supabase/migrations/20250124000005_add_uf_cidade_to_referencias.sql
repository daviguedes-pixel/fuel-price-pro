-- Adicionar colunas UF e cidade à tabela referencias se não existirem
ALTER TABLE public.referencias 
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_referencias_uf ON public.referencias(uf);
CREATE INDEX IF NOT EXISTS idx_referencias_cidade ON public.referencias(cidade);

-- Atualizar registros existentes que não têm UF/cidade
-- Buscar UF e cidade das tabelas relacionadas
UPDATE public.referencias 
SET 
  uf = COALESCE(
    (SELECT c.uf FROM public.concorrentes c WHERE c.id_posto::text = referencias.posto_id::text),
    (SELECT c.estado FROM public.concorrentes c WHERE c.id_posto::text = referencias.posto_id::text),
    (SELECT s.uf FROM public.stations s WHERE s.id::text = referencias.posto_id::text)
  ),
  cidade = COALESCE(
    (SELECT c.municipio FROM public.concorrentes c WHERE c.id_posto::text = referencias.posto_id::text),
    (SELECT c.cidade FROM public.concorrentes c WHERE c.id_posto::text = referencias.posto_id::text),
    (SELECT s.cidade FROM public.stations s WHERE s.id::text = referencias.posto_id::text)
  )
WHERE uf IS NULL OR cidade IS NULL;


