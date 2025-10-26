-- Fix security warning: Set search_path on the function
DROP FUNCTION IF EXISTS public.get_lowest_cost_freight(TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.get_lowest_cost_freight(
  p_posto_id TEXT,
  p_produto TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  base_id TEXT,
  custo NUMERIC,
  frete NUMERIC,
  custo_total NUMERIC,
  data_referencia TIMESTAMP
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cotacao
AS $$
BEGIN
  -- Busca o menor (custo + frete) da mesma base no schema cotacao
  -- Assumindo que:
  -- - base_fornecedor.nome_da_coluna_1 = identificador da base/fornecedor
  -- - base_fornecedor.valor_float = custo
  -- - frete_empresa.nome_da_coluna_1 = identificador da base/fornecedor
  -- - frete_empresa.valor_float = frete
  -- - nome_da_coluna_2 = data
  
  RETURN QUERY
  SELECT 
    bf.nome_da_coluna_1 as base_id,
    bf.valor_float as custo,
    COALESCE(fe.valor_float, 0) as frete,
    (bf.valor_float + COALESCE(fe.valor_float, 0)) as custo_total,
    bf.nome_da_coluna_2 as data_referencia
  FROM cotacao.base_fornecedor bf
  LEFT JOIN cotacao.frete_empresa fe 
    ON bf.nome_da_coluna_1 = fe.nome_da_coluna_1
    AND DATE(fe.nome_da_coluna_2) = p_date
  WHERE DATE(bf.nome_da_coluna_2) = p_date
  ORDER BY (bf.valor_float + COALESCE(fe.valor_float, 0)) ASC
  LIMIT 1;
  
  -- Se não encontrar no cotacao, tentar buscar na tabela referencias
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.posto_id as base_id,
      r.preco_referencia as custo,
      0::NUMERIC as frete,
      r.preco_referencia as custo_total,
      r.created_at as data_referencia
    FROM public.referencias r
    WHERE r.posto_id = p_posto_id
      AND r.produto = p_produto
      AND DATE(r.created_at) = p_date
    ORDER BY r.preco_referencia ASC
    LIMIT 1;
  END IF;
END;
$$;