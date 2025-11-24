    -- =====================================================
    -- ADICIONAR COLUNA 'data' À TABELA NOTIFICATIONS
    -- =====================================================
    -- Esta migration adiciona a coluna 'data' (JSONB) se ela não existir
    -- A coluna é usada para armazenar dados adicionais como approved_by, rejected_by, etc.

    -- Adicionar coluna 'data' se não existir
    DO $$ 
    BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'data'
    ) THEN
        ALTER TABLE public.notifications 
        ADD COLUMN data JSONB;
        
        RAISE NOTICE 'Coluna "data" adicionada à tabela notifications';
    ELSE
        RAISE NOTICE 'Coluna "data" já existe na tabela notifications';
    END IF;
    END $$;

    -- Adicionar comentário na coluna
    COMMENT ON COLUMN public.notifications.data IS 'Dados adicionais da notificação em formato JSON (ex: approved_by, rejected_by, url, etc.)';

