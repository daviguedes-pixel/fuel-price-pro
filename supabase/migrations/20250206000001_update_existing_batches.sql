-- Atualizar solicitações existentes que foram criadas juntas para terem o mesmo batch_id
-- Agrupa por data, criador e timestamp muito próximo (dentro de 10 segundos)

DO $$
DECLARE
    batch_uuid UUID;
    current_date_key DATE;
    current_creator TEXT;
    current_timestamp TIMESTAMP WITH TIME ZONE;
    request_record RECORD;
    processed_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    -- Processar todas as solicitações que não têm batch_id (qualquer status)
    FOR request_record IN 
        SELECT id, created_at, created_by, requested_by
        FROM public.price_suggestions
        WHERE batch_id IS NULL
        ORDER BY created_at ASC, created_by ASC, requested_by ASC
    LOOP
        -- Se já foi processado, pular
        IF request_record.id = ANY(processed_ids) THEN
            CONTINUE;
        END IF;
        
        current_date_key := DATE(request_record.created_at);
        current_creator := COALESCE(request_record.created_by, request_record.requested_by, 'unknown');
        current_timestamp := request_record.created_at;
        
        -- Procurar se há um batch_id existente para solicitações criadas no mesmo dia,
        -- pelo mesmo criador, e com timestamp muito próximo (dentro de 10 segundos)
        SELECT batch_id INTO batch_uuid
        FROM public.price_suggestions
        WHERE batch_id IS NOT NULL
        AND DATE(created_at) = current_date_key
        AND COALESCE(created_by, requested_by, 'unknown') = current_creator
        AND ABS(EXTRACT(EPOCH FROM (created_at - current_timestamp))) < 10
        LIMIT 1;
        
        -- Se não encontrou batch_id existente, criar um novo
        IF batch_uuid IS NULL THEN
            batch_uuid := gen_random_uuid();
        END IF;
        
        -- Atualizar todas as solicitações que foram criadas juntas (mesmo dia, mesmo criador, timestamp muito próximo)
        -- Marcar IDs processados para evitar reprocessamento
        WITH updated AS (
            UPDATE public.price_suggestions
            SET batch_id = batch_uuid
            WHERE batch_id IS NULL
            AND DATE(created_at) = current_date_key
            AND COALESCE(created_by, requested_by, 'unknown') = current_creator
            AND ABS(EXTRACT(EPOCH FROM (created_at - current_timestamp))) < 10
            RETURNING id
        )
        SELECT array_agg(id) INTO processed_ids FROM updated;
        
        -- Adicionar IDs processados ao array
        IF processed_ids IS NOT NULL THEN
            processed_ids := processed_ids || (SELECT array_agg(id) FROM public.price_suggestions 
                WHERE batch_id = batch_uuid AND id != ALL(processed_ids));
        END IF;
        
        RAISE NOTICE '✅ Batch criado/atualizado: % para solicitações criadas em %', 
            batch_uuid, 
            current_timestamp;
    END LOOP;
    
    RAISE NOTICE '✅ Migração concluída: batch_id atribuído a todas as solicitações criadas juntas';
END $$;

-- Verificar resultados
SELECT 
    batch_id,
    COUNT(*) as total_solicitacoes,
    MIN(created_at) as primeira_criacao,
    MAX(created_at) as ultima_criacao,
    STRING_AGG(DISTINCT COALESCE(created_by, requested_by, 'unknown'), ', ') as criadores
FROM public.price_suggestions
WHERE batch_id IS NOT NULL
GROUP BY batch_id
HAVING COUNT(*) > 1
ORDER BY primeira_criacao DESC
LIMIT 20;

