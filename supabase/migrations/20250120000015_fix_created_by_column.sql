-- Corrigir coluna created_by faltante na tabela price_suggestions
-- Esta migração garante que todas as colunas necessárias existam

-- Verificar e adicionar coluna created_by se não existir
DO $$ 
BEGIN
    -- Adicionar coluna created_by se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN created_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Coluna created_by adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna created_by já existe na tabela price_suggestions';
    END IF;

    -- Verificar e adicionar coluna margin_cents se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'margin_cents'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN margin_cents INTEGER;
        RAISE NOTICE 'Coluna margin_cents adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna margin_cents já existe na tabela price_suggestions';
    END IF;

    -- Verificar e adicionar coluna current_price se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'current_price'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN current_price NUMERIC(10,3);
        RAISE NOTICE 'Coluna current_price adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna current_price já existe na tabela price_suggestions';
    END IF;

    -- Verificar e adicionar coluna suggested_price se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'suggested_price'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN suggested_price NUMERIC(10,3);
        RAISE NOTICE 'Coluna suggested_price adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna suggested_price já existe na tabela price_suggestions';
    END IF;

    -- Verificar e adicionar coluna attachments se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'attachments'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN attachments TEXT[];
        RAISE NOTICE 'Coluna attachments adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna attachments já existe na tabela price_suggestions';
    END IF;

    -- Verificar e adicionar coluna status se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN status TEXT DEFAULT 'pending';
        RAISE NOTICE 'Coluna status adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna status já existe na tabela price_suggestions';
    END IF;

    -- Verificar e adicionar coluna reference_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' AND column_name = 'reference_id'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN reference_id UUID REFERENCES public.referencias(id);
        RAISE NOTICE 'Coluna reference_id adicionada à tabela price_suggestions';
    ELSE
        RAISE NOTICE 'Coluna reference_id já existe na tabela price_suggestions';
    END IF;

END $$;

-- Verificar se a tabela referencias existe, se não, criar
CREATE TABLE IF NOT EXISTS public.referencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_referencia TEXT UNIQUE NOT NULL DEFAULT 'REF-' || EXTRACT(EPOCH FROM now())::TEXT,
    posto_id UUID REFERENCES public.stations(id) NOT NULL,
    cliente_id UUID REFERENCES public.clients(id) NOT NULL,
    produto TEXT NOT NULL,
    preco_referencia DECIMAL(10,2) NOT NULL,
    tipo_pagamento_id UUID REFERENCES public.payment_methods(id),
    observacoes TEXT,
    anexo TEXT,
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para referencias se não estiver habilitado
ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;

-- Políticas para referencias se não existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referencias' AND policyname = 'Users can view references'
    ) THEN
        CREATE POLICY "Users can view references" 
        ON public.referencias 
        FOR SELECT 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referencias' AND policyname = 'Users can insert references'
    ) THEN
        CREATE POLICY "Users can insert references" 
        ON public.referencias 
        FOR INSERT 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'referencias' AND policyname = 'Users can update references'
    ) THEN
        CREATE POLICY "Users can update references" 
        ON public.referencias 
        FOR UPDATE 
        USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Verificar se as tabelas sis_empresa e concorrentes existem
CREATE TABLE IF NOT EXISTS public.sis_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    codigo TEXT UNIQUE,
    endereco TEXT,
    cidade TEXT,
    bandeira TEXT,
    marca TEXT,
    localizacao TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.concorrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    codigo TEXT UNIQUE,
    endereco TEXT,
    cidade TEXT,
    bandeira TEXT,
    marca TEXT,
    localizacao TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para as novas tabelas
ALTER TABLE public.sis_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concorrentes ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para as novas tabelas
DO $$
BEGIN
    -- Políticas para sis_empresa
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sis_empresa' AND policyname = 'Users can view sis_empresa'
    ) THEN
        CREATE POLICY "Users can view sis_empresa" 
        ON public.sis_empresa 
        FOR SELECT 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'sis_empresa' AND policyname = 'Users can insert sis_empresa'
    ) THEN
        CREATE POLICY "Users can insert sis_empresa" 
        ON public.sis_empresa 
        FOR INSERT 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;

    -- Políticas para concorrentes
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'concorrentes' AND policyname = 'Users can view concorrentes'
    ) THEN
        CREATE POLICY "Users can view concorrentes" 
        ON public.concorrentes 
        FOR SELECT 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'concorrentes' AND policyname = 'Users can insert concorrentes'
    ) THEN
        CREATE POLICY "Users can insert concorrentes" 
        ON public.concorrentes 
        FOR INSERT 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- Verificar se a tabela clientes existe (para substituir clients)
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    id_cliente TEXT UNIQUE,
    contato_email TEXT,
    contato_telefone TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS para clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Políticas para clientes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clientes' AND policyname = 'Users can view clientes'
    ) THEN
        CREATE POLICY "Users can view clientes" 
        ON public.clientes 
        FOR SELECT 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clientes' AND policyname = 'Users can insert clientes'
    ) THEN
        CREATE POLICY "Users can insert clientes" 
        ON public.clientes 
        FOR INSERT 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- Verificar e adicionar coluna perfil na tabela user_profiles se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'perfil'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN perfil TEXT DEFAULT 'analista_pricing';
        RAISE NOTICE 'Coluna perfil adicionada à tabela user_profiles';
    ELSE
        RAISE NOTICE 'Coluna perfil já existe na tabela user_profiles';
    END IF;
END $$;

-- Log de sucesso
DO $$
BEGIN
    RAISE NOTICE 'Migração 20250120000015_fix_created_by_column.sql executada com sucesso!';
    RAISE NOTICE 'Todas as colunas necessárias foram verificadas e criadas se necessário.';
    RAISE NOTICE 'Tabelas sis_empresa, concorrentes e clientes foram criadas se não existiam.';
    RAISE NOTICE 'Coluna perfil adicionada à tabela user_profiles.';
END $$;
