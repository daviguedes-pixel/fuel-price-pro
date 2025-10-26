-- Criar tabela external_connections de forma simples
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

-- Políticas RLS simples - permitir tudo para usuários autenticados
DROP POLICY IF EXISTS "external_connections_policy" ON public.external_connections;
CREATE POLICY "external_connections_policy" ON public.external_connections
  FOR ALL USING (auth.role() = 'authenticated');

-- Inserir dados de exemplo
INSERT INTO public.external_connections (
  name, 
  description, 
  connection_type, 
  host, 
  port, 
  database_name, 
  username, 
  password, 
  ssl_enabled, 
  active, 
  created_by
) VALUES (
  'Postos/Cotações',
  'Conexão com banco de dados de postos e cotações',
  'postgresql',
  'brapoio-dw.fly.dev',
  5432,
  'analytics',
  'davi_guedes',
  'sua_senha_aqui',
  true,
  true,
  'davi.guedes@example.com'
) ON CONFLICT DO NOTHING;
