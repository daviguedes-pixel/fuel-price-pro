-- Corrigir colunas faltantes na tabela price_suggestions
-- Esta migration garante que todas as colunas necessárias existam

-- Adicionar coluna arla_price se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'arla_price'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN arla_price NUMERIC(10,3);
    END IF;
END $$;

-- Adicionar coluna current_price se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'current_price'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN current_price NUMERIC(10,3);
    END IF;
END $$;

-- Adicionar coluna margin_cents se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'margin_cents'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN margin_cents INTEGER;
    END IF;
END $$;

-- Adicionar coluna reference_id se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'reference_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN reference_id UUID REFERENCES public.referencias(id);
    END IF;
END $$;

-- Adicionar coluna payment_method_id se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'payment_method_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN payment_method_id UUID REFERENCES public.payment_methods(id);
    END IF;
END $$;

-- Adicionar coluna attachments se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'attachments'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN attachments TEXT[];
    END IF;
END $$;

-- Adicionar coluna observations se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'observations'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN observations TEXT;
    END IF;
END $$;

-- Adicionar coluna created_by se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'created_by'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Adicionar coluna requested_by se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'requested_by'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN requested_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Adicionar coluna status se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Adicionar coluna approved_by se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'approved_by'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN approved_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Adicionar coluna approved_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'approved_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Adicionar coluna rejection_reason se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'rejection_reason'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- Adicionar coluna created_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'created_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Adicionar coluna updated_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'price_suggestions' 
        AND column_name = 'updated_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.price_suggestions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;
