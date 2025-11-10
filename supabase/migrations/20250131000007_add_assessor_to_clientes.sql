-- Adicionar coluna de assessor comercial vinculado ao cliente
ALTER TABLE IF EXISTS public.clientes
ADD COLUMN IF NOT EXISTS assessor_id UUID NULL;

-- Índice para acelerar filtros por assessor
CREATE INDEX IF NOT EXISTS idx_clientes_assessor_id ON public.clientes(assessor_id);

-- Função para obter clientes vinculados ao assessor logado
-- Perfis com privilégios (admin/diretores) visualizam todos
CREATE OR REPLACE FUNCTION public.get_clientes_por_assessor()
RETURNS TABLE (
  id_cliente TEXT,
  nome TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id_cliente::text,
    c.nome
  FROM public.clientes c
  WHERE 
    -- Admin ou diretores veem todos
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id::text = auth.uid()::text
        AND (up.role = 'admin' OR up.perfil IN ('diretor_comercial','diretor_pricing'))
    )
    OR c.assessor_id::text = auth.uid()::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_clientes_por_assessor IS
'Retorna apenas os clientes vinculados ao assessor logado; admins/diretores veem todos.';


