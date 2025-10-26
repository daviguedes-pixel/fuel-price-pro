CREATE OR REPLACE FUNCTION public.get_lowest_cost_freight(p_posto_id text, p_produto text, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(base_id text, base_nome text, base_codigo text, base_uf text, custo numeric, frete numeric, custo_total numeric, forma_entrega text, data_referencia timestamp without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cotacao'
AS $function$
DECLARE
  v_company_code TEXT;
  v_id_empresa BIGINT;
  v_station_name TEXT;
  v_company_name TEXT;
  v_latest_date DATE;
BEGIN
  -- Descobrir nome da estação pelo código
  SELECT s.name INTO v_station_name
  FROM public.stations s
  WHERE s.code = p_posto_id
  LIMIT 1;

  -- Tentar resolver por company_code exato ou nome da estação
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

  -- Se não encontrado, resolver nome da empresa via CNPJ em sis_empresa
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

  -- Fallback: usar p_posto_id diretamente no nome_empresa
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

  -- Se empresa resolvida, buscar custo com frete e descontos para a data
  IF v_id_empresa IS NOT NULL THEN
    RETURN QUERY
    WITH cotacoes_bandeira AS (
      SELECT 
        (bf.id_base_fornecedor)::TEXT AS base_id,
        COALESCE(bf.nome, 'Base não identificada')::TEXT AS base_nome,
        COALESCE(bf.codigo_base, '')::TEXT AS base_codigo,
        COALESCE(bf.uf::TEXT, '')::TEXT AS base_uf,
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))::NUMERIC AS valor_com_desconto,
        COALESCE(fe.frete_real, fe.frete_atual, 0)::NUMERIC AS valor_frete,
        cc.forma_entrega::TEXT AS forma_entrega,
        (cc.data_cotacao)::TIMESTAMP AS data_referencia,
        CASE 
          WHEN cc.forma_entrega = 'FOB' THEN 
            (cc.valor_unitario - COALESCE(cc.desconto_valor, 0) + COALESCE(fe.frete_real, fe.frete_atual, 0))
          ELSE 
            (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
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
      
      UNION ALL
      
      SELECT 
        (bf.id_base_fornecedor)::TEXT AS base_id,
        COALESCE(bf.nome, 'Base não identificada')::TEXT AS base_nome,
        COALESCE(bf.codigo_base, '')::TEXT AS base_codigo,
        COALESCE(bf.uf::TEXT, '')::TEXT AS base_uf,
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))::NUMERIC AS valor_com_desconto,
        0::NUMERIC AS valor_frete,
        cg.forma_entrega::TEXT AS forma_entrega,
        (cg.data_cotacao)::TIMESTAMP AS data_referencia,
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))::NUMERIC AS custo_total_calculado
      FROM cotacao.cotacao_geral_combustivel cg
      INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
      LEFT JOIN cotacao.base_fornecedor bf ON cg.id_base_fornecedor = bf.id_base_fornecedor
      WHERE cg.id_empresa = v_id_empresa
        AND cg.status_cotacao = 'ATIVO'
        AND DATE(cg.data_cotacao) = p_date
        AND (
          gci.nome ILIKE '%' || p_produto || '%' 
          OR gci.descricao ILIKE '%' || p_produto || '%'
        )
    )
    SELECT 
      cf.base_id,
      cf.base_nome,
      cf.base_codigo,
      cf.base_uf,
      cf.valor_com_desconto AS custo,
      cf.valor_frete AS frete,
      cf.custo_total_calculado AS custo_total,
      cf.forma_entrega,
      cf.data_referencia
    FROM cotacoes_bandeira cf
    ORDER BY cf.custo_total_calculado ASC
    LIMIT 1;

    -- Se não encontrado para a data, buscar a data mais recente
    IF NOT FOUND THEN
      SELECT MAX(DATE(cc.data_cotacao))
      INTO v_latest_date
      FROM (
        SELECT data_cotacao FROM cotacao.cotacao_combustivel 
        WHERE id_empresa = v_id_empresa AND status_cotacao = 'ATIVO'
        UNION ALL
        SELECT data_cotacao FROM cotacao.cotacao_geral_combustivel 
        WHERE id_empresa = v_id_empresa AND status_cotacao = 'ATIVO'
      ) cc;

      IF v_latest_date IS NOT NULL THEN
        RETURN QUERY
        WITH cotacoes_bandeira AS (
          SELECT 
            (bf.id_base_fornecedor)::TEXT AS base_id,
            COALESCE(bf.nome, 'Base não identificada')::TEXT AS base_nome,
            COALESCE(bf.codigo_base, '')::TEXT AS base_codigo,
            COALESCE(bf.uf::TEXT, '')::TEXT AS base_uf,
            (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))::NUMERIC AS valor_com_desconto,
            COALESCE(fe.frete_real, fe.frete_atual, 0)::NUMERIC AS valor_frete,
            cc.forma_entrega::TEXT AS forma_entrega,
            (cc.data_cotacao)::TIMESTAMP AS data_referencia,
            CASE 
              WHEN cc.forma_entrega = 'FOB' THEN 
                (cc.valor_unitario - COALESCE(cc.desconto_valor, 0) + COALESCE(fe.frete_real, fe.frete_atual, 0))
              ELSE 
                (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
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
          
          UNION ALL
          
          SELECT 
            (bf.id_base_fornecedor)::TEXT AS base_id,
            COALESCE(bf.nome, 'Base não identificada')::TEXT AS base_nome,
            COALESCE(bf.codigo_base, '')::TEXT AS base_codigo,
            COALESCE(bf.uf::TEXT, '')::TEXT AS base_uf,
            (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))::NUMERIC AS valor_com_desconto,
            0::NUMERIC AS valor_frete,
            cg.forma_entrega::TEXT AS forma_entrega,
            (cg.data_cotacao)::TIMESTAMP AS data_referencia,
            (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))::NUMERIC AS custo_total_calculado
          FROM cotacao.cotacao_geral_combustivel cg
          INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
          LEFT JOIN cotacao.base_fornecedor bf ON cg.id_base_fornecedor = bf.id_base_fornecedor
          WHERE cg.id_empresa = v_id_empresa
            AND cg.status_cotacao = 'ATIVO'
            AND DATE(cg.data_cotacao) = v_latest_date
            AND (
              gci.nome ILIKE '%' || p_produto || '%' 
              OR gci.descricao ILIKE '%' || p_produto || '%'
            )
        )
        SELECT 
          cf.base_id,
          cf.base_nome,
          cf.base_codigo,
          cf.base_uf,
          cf.valor_com_desconto AS custo,
          cf.valor_frete AS frete,
          cf.custo_total_calculado AS custo_total,
          cf.forma_entrega,
          cf.data_referencia
        FROM cotacoes_bandeira cf
        ORDER BY cf.custo_total_calculado ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- Fallback: última referência manual
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
$function$;