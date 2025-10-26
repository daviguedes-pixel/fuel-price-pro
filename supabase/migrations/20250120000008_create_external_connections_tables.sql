-- Garantir que a tabela external_connections existe
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

-- Garantir que a tabela external_table_mappings existe
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

-- Garantir que a tabela sync_logs existe
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

-- Adicionar RLS policies se não existirem
DO $$ 
BEGIN
  -- Policy para external_connections
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
END $$;

-- Habilitar RLS nas tabelas
ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_table_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
