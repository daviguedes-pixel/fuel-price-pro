-- Function to get id_empresa from sis_empresa by nome_empresa (case-insensitive search)
-- This function allows querying sis_empresa from the cotacao schema via RPC
CREATE OR REPLACE FUNCTION public.get_sis_empresa_id_by_name(
  p_nome_empresa text
)
RETURNS TABLE(
  id_empresa bigint,
  nome_empresa text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $$
  SELECT 
    se.id_empresa,
    se.nome_empresa
  FROM cotacao.sis_empresa se
  WHERE se.nome_empresa ILIKE '%' || p_nome_empresa || '%'
  ORDER BY se.nome_empresa
  LIMIT 1;
$$;

