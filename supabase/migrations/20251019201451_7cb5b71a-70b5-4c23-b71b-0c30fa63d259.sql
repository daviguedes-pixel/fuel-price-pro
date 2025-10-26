-- Function to fetch stations directly from cotacao.sis_empresa
CREATE OR REPLACE FUNCTION public.get_sis_empresa_stations()
RETURNS TABLE(
  nome_empresa text,
  cnpj_cpf text,
  latitude numeric,
  longitude numeric,
  bandeira text,
  rede text,
  registro_ativo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $$
  SELECT DISTINCT ON (COALESCE(se.cnpj_cpf, se.nome_empresa))
    se.nome_empresa,
    se.cnpj_cpf,
    se.latitude,
    se.longitude,
    se.bandeira,
    se.rede,
    COALESCE(se.registro_ativo::text, 'S') AS registro_ativo
  FROM cotacao.sis_empresa se
  WHERE se.nome_empresa IS NOT NULL AND se.nome_empresa <> ''
  ORDER BY COALESCE(se.cnpj_cpf, se.nome_empresa), se.nome_empresa;
$$;