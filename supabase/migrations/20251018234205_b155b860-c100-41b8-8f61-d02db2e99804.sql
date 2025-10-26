-- Improve company resolution using sis_empresa by CNPJ/name
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
  v_station_name TEXT;
  v_company_name TEXT;
  v_latest_date DATE;
BEGIN
  -- Discover station name by code (if exists in public.stations)
  SELECT s.name INTO v_station_name
  FROM public.stations s
  WHERE s.code = p_posto_id
  LIMIT 1;

  -- Try resolve by exact company_code or station name
  SELECT t.company_code, t.id_empresa
  INTO v_company_code, v_id_empresa
  FROM (
    SELECT cc.company_code, cc.id_empresa, cc.data_cotacao
    FROM cotacao.cotacao_combustivel cc
    WHERE cc.status_cotacao = 'ATIVO'
      AND (
        cc.company_code = p_posto_id OR
        (v_station_name IS NOT NULL AND cc.nome_empresa ILIKE '%' || v_station_name || '%')
      )
    ORDER BY cc.data_cotacao DESC
    LIMIT 1
  ) t;

  -- If not found, resolve company name via CNPJ in sis_empresa (public or cotacao)
  IF v_id_empresa IS NULL THEN
    SELECT COALESCE(
      (SELECT se.nome_empresa FROM public.sis_empresa se WHERE se.cnpj_cpf = p_posto_id LIMIT 1),
      (SELECT se.nome_empresa FROM cotacao.sis_empresa se WHERE se.cnpj_cpf = p_posto_id LIMIT 1)
    ) INTO v_company_name;

    IF v_company_name IS NOT NULL THEN
      SELECT t2.company_code, t2.id_empresa
      INTO v_company_code, v_id_empresa
      FROM (
        SELECT cc.company_code, cc.id_empresa, cc.data_cotacao
        FROM cotacao.cotacao_combustivel cc
        WHERE cc.status_cotacao = 'ATIVO'
          AND cc.nome_empresa ILIKE '%' || v_company_name || '%'
        ORDER BY cc.data_cotacao DESC
        LIMIT 1
      ) t2;
    END IF;
  END IF;

  -- As last name-based fallback, try using the posto_id text itself in nome_empresa
  IF v_id_empresa IS NULL THEN
    SELECT t3.company_code, t3.id_empresa
    INTO v_company_code, v_id_empresa
    FROM (
      SELECT cc.company_code, cc.id_empresa, cc.data_cotacao
      FROM cotacao.cotacao_combustivel cc
      WHERE cc.status_cotacao = 'ATIVO'
        AND cc.nome_empresa ILIKE '%' || p_posto_id || '%'
      ORDER BY cc.data_cotacao DESC
      LIMIT 1
    ) t3;
  END IF;

  -- If company resolved, fetch cost for the date or latest
  IF v_id_empresa IS NOT NULL THEN
    RETURN QUERY
    WITH cotacoes_com_frete AS (
      SELECT 
        (bf.id_base_fornecedor)::TEXT AS base_id,
        COALESCE(bf.nome, 'Base não identificada')::TEXT AS base_nome,
        COALESCE(bf.codigo_base, '')::TEXT AS base_codigo,
        COALESCE(bf.uf::TEXT, '')::TEXT AS base_uf,
        (cc.valor_unitario)::NUMERIC AS valor_unitario,
        COALESCE(fe.frete_atual, fe.frete_real, 0)::NUMERIC AS valor_frete,
        cc.forma_entrega::TEXT AS forma_entrega,
        (cc.data_cotacao)::TIMESTAMP AS data_referencia,
        CASE 
          WHEN cc.forma_entrega = 'FOB' THEN (cc.valor_unitario + COALESCE(fe.frete_atual, fe.frete_real, 0))
          ELSE cc.valor_unitario
        END::NUMERIC AS custo_total_calculado
      FROM cotacao.cotacao_combustivel cc
      INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON cc.id_base_fornecedor = bf.id_base_fornecedor
      LEFT JOIN cotacao.frete_empresa fe ON cc.id_empresa = fe.id_empresa 
        AND cc.id_base_fornecedor = fe.id_base_fornecedor
        AND fe.registro_ativo = true
      WHERE cc.id_empresa = v_id_empresa
        AND cc.status_cotacao = 'ATIVO'
        AND DATE(cc.data_cotacao) = p_date
        AND (
          gci.nome ILIKE '%' || p_produto || '%' 
          OR gci.descricao ILIKE '%' || p_produto || '%'
        )
    )
    SELECT 
      base_id,
      base_nome,
      base_codigo,
      base_uf,
      valor_unitario AS custo,
      valor_frete AS frete,
      custo_total_calculado AS custo_total,
      forma_entrega,
      data_referencia
    FROM cotacoes_com_frete
    ORDER BY custo_total ASC
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT MAX(DATE(cc.data_cotacao))
      INTO v_latest_date
      FROM cotacao.cotacao_combustivel cc
      INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
      WHERE cc.id_empresa = v_id_empresa
        AND cc.status_cotacao = 'ATIVO'
        AND (
          gci.nome ILIKE '%' || p_produto || '%' 
          OR gci.descricao ILIKE '%' || p_produto || '%'
        );

      IF v_latest_date IS NOT NULL THEN
        RETURN QUERY
        WITH cotacoes_com_frete AS (
          SELECT 
            (bf.id_base_fornecedor)::TEXT AS base_id,
            COALESCE(bf.nome, 'Base não identificada')::TEXT AS base_nome,
            COALESCE(bf.codigo_base, '')::TEXT AS base_codigo,
            COALESCE(bf.uf::TEXT, '')::TEXT AS base_uf,
            (cc.valor_unitario)::NUMERIC AS valor_unitario,
            COALESCE(fe.frete_atual, fe.frete_real, 0)::NUMERIC AS valor_frete,
            cc.forma_entrega::TEXT AS forma_entrega,
            (cc.data_cotacao)::TIMESTAMP AS data_referencia,
            CASE 
              WHEN cc.forma_entrega = 'FOB' THEN (cc.valor_unitario + COALESCE(fe.frete_atual, fe.frete_real, 0))
              ELSE cc.valor_unitario
            END::NUMERIC AS custo_total_calculado
          FROM cotacao.cotacao_combustivel cc
          INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
          LEFT JOIN cotacao.base_fornecedor bf ON cc.id_base_fornecedor = bf.id_base_fornecedor
          LEFT JOIN cotacao.frete_empresa fe ON cc.id_empresa = fe.id_empresa 
            AND cc.id_base_fornecedor = fe.id_base_fornecedor
            AND fe.registro_ativo = true
          WHERE cc.id_empresa = v_id_empresa
            AND cc.status_cotacao = 'ATIVO'
            AND DATE(cc.data_cotacao) = v_latest_date
            AND (
              gci.nome ILIKE '%' || p_produto || '%' 
              OR gci.descricao ILIKE '%' || p_produto || '%'
            )
        )
        SELECT 
          base_id,
          base_nome,
          base_codigo,
          base_uf,
          valor_unitario AS custo,
          valor_frete AS frete,
          custo_total_calculado AS custo_total,
          forma_entrega,
          data_referencia
        FROM cotacoes_com_frete
        ORDER BY custo_total ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- Fallback: last manual reference
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.posto_id::TEXT AS base_id,
      'Referência'::TEXT AS base_nome,
      r.posto_id::TEXT AS base_codigo,
      ''::TEXT AS base_uf,
      r.preco_referencia::NUMERIC AS custo,
      0::NUMERIC AS frete,
      r.preco_referencia::NUMERIC AS custo_total,
      'FOB'::TEXT AS forma_entrega,
      (r.created_at)::TIMESTAMP AS data_referencia
    FROM public.referencias r
    WHERE r.posto_id = p_posto_id
      AND r.produto ILIKE '%' || p_produto || '%'
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;