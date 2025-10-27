-- Fix tipos_pagamento ID - versão corrigida

-- Remover constraints antigas que possam causar conflito
ALTER TABLE IF EXISTS public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_id_key;
ALTER TABLE IF EXISTS public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_pkey;
ALTER TABLE IF EXISTS public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_id_seq;

-- Adicionar coluna id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tipos_pagamento' 
        AND column_name = 'id'
    ) THEN
        -- Adicionar coluna id como INTEGER
        ALTER TABLE public.tipos_pagamento ADD COLUMN id INTEGER;
        
        -- Criar sequence se não existir
        CREATE SEQUENCE IF NOT EXISTS tipos_pagamento_id_seq;
        
        -- Preencher IDs existentes
        UPDATE public.tipos_pagamento SET id = nextval('tipos_pagamento_id_seq') WHERE id IS NULL;
        
        -- Definir default para novos registros
        ALTER TABLE public.tipos_pagamento ALTER COLUMN id SET DEFAULT nextval('tipos_pagamento_id_seq');
        ALTER TABLE public.tipos_pagamento ALTER COLUMN id SET NOT NULL;
        
        -- Criar PRIMARY KEY
        ALTER TABLE public.tipos_pagamento ADD CONSTRAINT tipos_pagamento_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- Garantir que a sequence está configurada corretamente
SELECT setval('tipos_pagamento_id_seq', COALESCE((SELECT MAX(id) FROM public.tipos_pagamento), 0), true);


