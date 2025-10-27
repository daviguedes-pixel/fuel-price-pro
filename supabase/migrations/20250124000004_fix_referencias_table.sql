-- Garantir que a tabela referencias existe e tem dados de teste
-- Criar tabelas dependentes se não existirem

-- Criar tabela stations se não existir
CREATE TABLE IF NOT EXISTS public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela clients se não existir
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela payment_methods se não existir
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Garantir que a tabela referencias existe
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

-- Habilitar RLS
ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;

-- Políticas para referencias
DROP POLICY IF EXISTS "Users can view references" ON public.referencias;
CREATE POLICY "Users can view references" 
ON public.referencias 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert references" ON public.referencias;
CREATE POLICY "Users can insert references" 
ON public.referencias 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update references" ON public.referencias;
CREATE POLICY "Users can update references" 
ON public.referencias 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Inserir dados de teste se não existirem
INSERT INTO public.stations (id, name, code, latitude, longitude) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Posto Teste 1', 'PT001', -23.5505, -46.6333),
  ('550e8400-e29b-41d4-a716-446655440002', 'Posto Teste 2', 'PT002', -23.5506, -46.6334)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clients (id, name, code) VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', 'Cliente Teste 1', 'CT001'),
  ('660e8400-e29b-41d4-a716-446655440002', 'Cliente Teste 2', 'CT002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payment_methods (id, name, description) VALUES 
  ('770e8400-e29b-41d4-a716-446655440001', 'Dinheiro', 'Pagamento em dinheiro'),
  ('770e8400-e29b-41d4-a716-446655440002', 'Cartão', 'Pagamento com cartão')
ON CONFLICT (id) DO NOTHING;

-- Inserir referências de teste
INSERT INTO public.referencias (
  posto_id,
  cliente_id,
  produto,
  preco_referencia,
  tipo_pagamento_id,
  observacoes,
  anexo
) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'gasolina_comum', 5.50, '770e8400-e29b-41d4-a716-446655440001', 'Referência de teste 1', 'anexo1.jpg'),
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'etanol', 4.20, '770e8400-e29b-41d4-a716-446655440002', 'Referência de teste 2', 'anexo2.jpg'),
  ('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'diesel_s10', 6.80, '770e8400-e29b-41d4-a716-446655440001', 'Referência de teste 3', 'anexo3.jpg'),
  ('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'gasolina_aditivada', 5.80, '770e8400-e29b-41d4-a716-446655440002', 'Referência de teste 4', 'anexo4.jpg')
ON CONFLICT DO NOTHING;


