-- Verificar se a tabela tipos_pagamento tem um campo id como SERIAL ou se precisa de UUID
-- Se não existir, vamos remover a constraint e adicionar um id auto-incremento

-- Primeiro, verificar se existe um campo id
DO $$
BEGIN
    -- Adicionar coluna id se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tipos_pagamento' 
        AND column_name = 'id'
    ) THEN
        -- Adicionar coluna id como SERIAL
        ALTER TABLE public.tipos_pagamento ADD COLUMN id SERIAL PRIMARY KEY;
    END IF;
END $$;

-- Remover constraints antigas que possam causar conflito
ALTER TABLE IF EXISTS public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_id_key;
ALTER TABLE IF EXISTS public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_pkey;

-- Garantir que o id seja auto-incremento
DO $$
BEGIN
    -- Se já existe id mas não é SERIAL, vamos torná-lo
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tipos_pagamento' 
        AND column_name = 'id'
        AND data_type != 'integer'
    ) THEN
        -- Mudar para SERIAL
        ALTER TABLE public.tipos_pagamento ALTER COLUMN id TYPE SERIAL;
    END IF;
END $$;

-- Criar constraint PRIMARY KEY se não existir
ALTER TABLE public.tipos_pagamento ADD CONSTRAINT tipos_pagamento_pkey PRIMARY KEY (id);


