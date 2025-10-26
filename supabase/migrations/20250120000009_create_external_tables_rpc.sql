-- Função para criar a tabela external_connections se não existir
CREATE OR REPLACE FUNCTION create_external_connections_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Criar a tabela se não existir
  CREATE TABLE IF NOT EXISTS public.external_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    connection_type TEXT NOT NULL DEFAULT 'postgresql',
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 5432,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT,
    ssl_enabled BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Habilitar RLS
  ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;

  -- Criar policies se não existirem
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_connections' AND policyname = 'Users can view their own connections') THEN
    CREATE POLICY "Users can view their own connections" ON public.external_connections
      FOR SELECT USING (auth.uid()::text = created_by);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_connections' AND policyname = 'Users can insert their own connections') THEN
    CREATE POLICY "Users can insert their own connections" ON public.external_connections
      FOR INSERT WITH CHECK (auth.uid()::text = created_by);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_connections' AND policyname = 'Users can update their own connections') THEN
    CREATE POLICY "Users can update their own connections" ON public.external_connections
      FOR UPDATE USING (auth.uid()::text = created_by);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_connections' AND policyname = 'Users can delete their own connections') THEN
    CREATE POLICY "Users can delete their own connections" ON public.external_connections
      FOR DELETE USING (auth.uid()::text = created_by);
  END IF;
END;
$$;

-- Função para criar a tabela external_table_mappings se não existir
CREATE OR REPLACE FUNCTION create_external_table_mappings_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.external_table_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES public.external_connections(id) ON DELETE CASCADE,
    external_table_name TEXT NOT NULL,
    supabase_table_name TEXT NOT NULL,
    mapping_config JSONB,
    sync_frequency TEXT DEFAULT 'daily',
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  ALTER TABLE public.external_table_mappings ENABLE ROW LEVEL SECURITY;
END;
$$;

-- Função para criar a tabela sync_logs se não existir
CREATE OR REPLACE FUNCTION create_sync_logs_table_if_not_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES public.external_connections(id) ON DELETE CASCADE,
    mapping_id UUID REFERENCES public.external_table_mappings(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
  );

  ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
END;
$$;
