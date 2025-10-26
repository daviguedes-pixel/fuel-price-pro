-- Função RPC para criar tabela referencias se não existir
CREATE OR REPLACE FUNCTION public.create_referencias_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Criar tabela referencias se não existir
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

  -- Habilitar RLS se não estiver habilitado
  ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;

  -- Criar políticas se não existirem
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referencias' AND policyname = 'Users can view references') THEN
    CREATE POLICY "Users can view references" 
    ON public.referencias 
    FOR SELECT 
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referencias' AND policyname = 'Users can insert references') THEN
    CREATE POLICY "Users can insert references" 
    ON public.referencias 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referencias' AND policyname = 'Users can update references') THEN
    CREATE POLICY "Users can update references" 
    ON public.referencias 
    FOR UPDATE 
    USING (auth.role() = 'authenticated');
  END IF;

  -- Criar função para gerar código de referência se não existir
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_reference_code') THEN
    CREATE OR REPLACE FUNCTION public.generate_reference_code()
    RETURNS TEXT AS $$
    BEGIN
      RETURN 'REF-' || EXTRACT(EPOCH FROM now())::TEXT || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    END;
    $$ LANGUAGE plpgsql;
  END IF;

  -- Criar trigger se não existir
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_reference_code_trigger') THEN
    CREATE OR REPLACE FUNCTION public.set_reference_code()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.codigo_referencia IS NULL OR NEW.codigo_referencia = '' THEN
        NEW.codigo_referencia := public.generate_reference_code();
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER set_reference_code_trigger
      BEFORE INSERT ON public.referencias
      FOR EACH ROW
      EXECUTE FUNCTION public.set_reference_code();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que usuários autenticados executem esta função
GRANT EXECUTE ON FUNCTION public.create_referencias_table_if_not_exists() TO authenticated;
