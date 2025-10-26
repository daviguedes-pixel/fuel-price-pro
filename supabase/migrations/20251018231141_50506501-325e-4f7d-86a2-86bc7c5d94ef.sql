-- Drop and recreate function to search for lowest cost from the same company (posto)
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
DECLARE
  v_company_code TEXT;
  v_id_empresa BIGINT;
BEGIN
  -- Primeiro tenta encontrar o company_code mapeando pelo nome da empresa no posto
  -- Busca em public.stations ou usa o posto_id diretamente
  SELECT DISTINCT cc.company_code, cc.id_empresa
  INTO v_company_code, v_id_empresa
  FROM cotacao.cotacao_combustivel cc
  INNER JOIN public.stations s ON (
    cc.nome_empresa ILIKE '%' || s.name || '%' 
    OR s.code = p_posto_id
  )
  WHERE s.code = p_posto_id
    AND cc.status_cotacao = 'ATIVO'
  LIMIT 1;

  -- Se não encontrar pela correlação com stations, busca diretamente usando o posto_id como company_code
  IF v_company_code IS NULL THEN
    SELECT DISTINCT company_code, id_empresa
    INTO v_company_code, v_id_empresa
    FROM cotacao.cotacao_combustivel
    WHERE company_code = p_posto_id
      AND status_cotacao = 'ATIVO'
    LIMIT 1;
  END IF;

  -- Se encontrou a empresa, busca o menor custo+frete para essa empresa
  IF v_id_empresa IS NOT NULL THEN
    RETURN QUERY
    WITH cotacoes_com_frete AS (
      SELECT 
        bf.id_base_fornecedor::TEXT as base_id,
        COALESCE(bf.nome, 'Base não identificada') as base_nome,
        COALESCE(bf.codigo_base, '') as base_codigo,
        COALESCE(bf.uf, '')::TEXT as base_uf,
        cc.valor_unitario,
        cc.forma_entrega,
        cc.data_cotacao::TIMESTAMP as data_referencia,
        COALESCE(fe.frete_atual, fe.frete_real, 0) as valor_frete,
        CASE 
          -- Se for FOB, soma o frete ao valor unitário
          WHEN cc.forma_entrega = 'FOB' THEN cc.valor_unitario + COALESCE(fe.frete_atual, fe.frete_real, 0)
          -- Se for CIF, o valor unitário já inclui o frete
          ELSE cc.valor_unitario
        END as custo_total_calculado
      FROM cotacao.cotacao_combustivel cc
      INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON cc.id_base_fornecedor = bf.id_base_fornecedor
      LEFT JOIN cotacao.frete_empresa fe ON cc.id_empresa = fe.id_empresa 
        AND cc.id_base_fornecedor = fe.id_base_fornecedor
        AND fe.registro_ativo = true
      WHERE cc.id_empresa = v_id_empresa
        AND cc.status_cotacao = 'ATIVO'
        AND DATE(cc.data_cotacao) >= p_date - INTERVAL '7 days'
        AND (
          gci.nome ILIKE '%' || p_produto || '%' 
          OR gci.descricao ILIKE '%' || p_produto || '%'
        )
    )
    SELECT 
      c.base_id,
      c.base_nome,
      c.base_codigo,
      c.base_uf,
      c.valor_unitario as custo,
      c.valor_frete as frete,
      c.custo_total_calculado as custo_total,
      c.forma_entrega,
      c.data_referencia
    FROM cotacoes_com_frete c
    ORDER BY c.custo_total_calculado ASC
    LIMIT 1;
  END IF;
  
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