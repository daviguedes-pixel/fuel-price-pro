-- =====================================================
-- MIGRAÇÃO PARA TABELAS DE POSTOS E CONCORRENTES
-- =====================================================

-- Criar tabela sis_empresa se não existir
CREATE TABLE IF NOT EXISTS public.sis_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela concorrentes se não existir
CREATE TABLE IF NOT EXISTS public.concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.sis_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concorrentes ENABLE ROW LEVEL SECURITY;

-- Políticas para sis_empresa
CREATE POLICY "Authenticated users can view sis_empresa" ON public.sis_empresa
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sis_empresa" ON public.sis_empresa
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update sis_empresa" ON public.sis_empresa
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Políticas para concorrentes
CREATE POLICY "Authenticated users can view concorrentes" ON public.concorrentes
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert concorrentes" ON public.concorrentes
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update concorrentes" ON public.concorrentes
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sis_empresa_nome ON public.sis_empresa(nome);
CREATE INDEX IF NOT EXISTS idx_sis_empresa_cidade ON public.sis_empresa(cidade);
CREATE INDEX IF NOT EXISTS idx_sis_empresa_ativo ON public.sis_empresa(ativo);

CREATE INDEX IF NOT EXISTS idx_concorrentes_nome ON public.concorrentes(nome);
CREATE INDEX IF NOT EXISTS idx_concorrentes_cidade ON public.concorrentes(cidade);
CREATE INDEX IF NOT EXISTS idx_concorrentes_ativo ON public.concorrentes(ativo);

-- Inserir dados de exemplo para sis_empresa (postos da Rede São Roque)
INSERT INTO public.sis_empresa (nome, endereco, cidade, estado, telefone, email) VALUES
('Posto São Roque Centro', 'Rua da Liberdade, 123', 'São Roque', 'SP', '(11) 4712-3456', 'centro@redesaoroque.com.br'),
('Posto São Roque Norte', 'Av. São Paulo, 456', 'São Roque', 'SP', '(11) 4712-3457', 'norte@redesaoroque.com.br'),
('Posto São Roque Sul', 'Rua das Flores, 789', 'São Roque', 'SP', '(11) 4712-3458', 'sul@redesaoroque.com.br'),
('Posto São Roque Leste', 'Av. Brasil, 321', 'São Roque', 'SP', '(11) 4712-3459', 'leste@redesaoroque.com.br'),
('Posto São Roque Oeste', 'Rua do Comércio, 654', 'São Roque', 'SP', '(11) 4712-3460', 'oeste@redesaoroque.com.br')
ON CONFLICT DO NOTHING;

-- Inserir dados de exemplo para concorrentes
INSERT INTO public.concorrentes (nome, endereco, cidade, estado, telefone, email) VALUES
('Auto Posto Pro Tork Rio Preto', 'Av. Presidente Vargas, 1000', 'São Roque', 'SP', '(11) 4712-2000', 'contato@protork.com.br'),
('Auto Posto Sidney', 'Rua das Palmeiras, 200', 'São Roque', 'SP', '(11) 4712-2001', 'contato@sidney.com.br'),
('Posto Shell Express', 'Av. Marginal, 500', 'São Roque', 'SP', '(11) 4712-2002', 'contato@shell.com.br'),
('Posto Ipiranga Plus', 'Rua do Comércio, 300', 'São Roque', 'SP', '(11) 4712-2003', 'contato@ipiranga.com.br'),
('Auto Posto Total', 'Av. São Paulo, 800', 'São Roque', 'SP', '(11) 4712-2004', 'contato@total.com.br'),
('Posto BR Distribuidora', 'Rua da Liberdade, 150', 'São Roque', 'SP', '(11) 4712-2005', 'contato@br.com.br'),
('Auto Posto Raizen', 'Av. Brasil, 400', 'São Roque', 'SP', '(11) 4712-2006', 'contato@raizen.com.br'),
('Posto Vibra Energia', 'Rua das Flores, 600', 'São Roque', 'SP', '(11) 4712-2007', 'contato@vibra.com.br')
ON CONFLICT DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE public.sis_empresa IS 'Postos da Rede São Roque';
COMMENT ON TABLE public.concorrentes IS 'Postos concorrentes para pesquisa de preços';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
