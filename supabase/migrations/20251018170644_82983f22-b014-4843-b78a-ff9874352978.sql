-- Drop and recreate function with correct schema structure
DROP FUNCTION IF EXISTS public.get_lowest_cost_freight(TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.get_lowest_cost_freight(
  p_posto_id TEXT,
  p_produto TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  base_id TEXT,
  base_nome TEXT,
  base_codigo TEXT,
  base_uf TEXT,
  custo NUMERIC,
  frete NUMERIC,
  custo_total NUMERIC,
  forma_entrega TEXT,
  data_referencia TIMESTAMP
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cotacao
AS $$
BEGIN
  -- Busca o menor valor_unitario (já inclui custo+frete para CIF) da cotacao_combustivel
  -- Filtra por produto e data
  RETURN QUERY
  SELECT 
    bf.id_base_fornecedor::TEXT as base_id,
    bf.nome as base_nome,
    bf.codigo_base as base_codigo,
    COALESCE(bf.uf, '')::TEXT as base_uf,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN cc.valor_unitario
      ELSE cc.valor_unitario
    END as custo,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN 0::NUMERIC
      ELSE 0::NUMERIC
    END as frete,
    cc.valor_unitario as custo_total,
    cc.forma_entrega as forma_entrega,
    cc.data_cotacao::TIMESTAMP as data_referencia
  FROM cotacao.cotacao_combustivel cc
  INNER JOIN cotacao.base_fornecedor bf ON cc.id_base_fornecedor = bf.id_base_fornecedor
  INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
  WHERE cc.status_cotacao = 'ATIVO'
    AND DATE(cc.data_cotacao) >= p_date - INTERVAL '7 days'  -- Busca nos últimos 7 dias
    AND (
      gci.nome ILIKE '%' || p_produto || '%' 
      OR gci.descricao ILIKE '%' || p_produto || '%'
    )
  ORDER BY cc.valor_unitario ASC
  LIMIT 1;
  
  -- Se não encontrar na cotacao, buscar na tabela referencias
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.posto_id as base_id,
      'Referência'::TEXT as base_nome,
      r.posto_id as base_codigo,
      ''::TEXT as base_uf,
      r.preco_referencia as custo,
      0::NUMERIC as frete,
      r.preco_referencia as custo_total,
      'FOB'::TEXT as forma_entrega,
      r.created_at as data_referencia
    FROM public.referencias r
    WHERE r.posto_id = p_posto_id
      AND r.produto ILIKE '%' || p_produto || '%'
      AND DATE(r.created_at) >= p_date - INTERVAL '7 days'
    ORDER BY r.preco_referencia ASC
    LIMIT 1;
  END IF;
END;
$$;