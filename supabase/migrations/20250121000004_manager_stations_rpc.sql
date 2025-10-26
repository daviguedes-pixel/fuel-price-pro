-- Função para buscar postos próprios vinculados ao gerente
CREATE OR REPLACE FUNCTION public.get_manager_stations(manager_user_id UUID)
RETURNS TABLE(
  id text,
  nome_empresa text,
  rede text,
  bandeira text,
  municipio text,
  uf text,
  latitude numeric,
  longitude numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $$
  SELECT 
    se.cnpj_cpf::text AS id,
    se.nome_empresa,
    se.rede,
    se.bandeira,
    se.municipio,
    se.uf,
    se.latitude,
    se.longitude
  FROM cotacao.sis_empresa se
  WHERE se.nome_empresa IS NOT NULL 
    AND se.nome_empresa <> ''
    AND se.registro_ativo = 'S'
    -- Aqui você pode adicionar lógica para filtrar por gerente específico
    -- Por exemplo, se houver uma tabela de vinculação gerente-posto
    -- AND EXISTS (
    --   SELECT 1 FROM manager_stations ms 
    --   WHERE ms.station_id = se.cnpj_cpf 
    --   AND ms.manager_id = manager_user_id
    -- )
$$;
