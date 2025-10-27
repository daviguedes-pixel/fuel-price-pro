-- Adicionar campos de brinde na tabela sis_empresa (postos)
-- Se a tabela não existir, será criada com os campos padrão

-- Verificar se a coluna existe, se não, adicionar
DO $$ 
BEGIN
  -- Adicionar coluna brinde_enabled se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sis_empresa' 
    AND column_name = 'brinde_enabled'
  ) THEN
    ALTER TABLE sis_empresa ADD COLUMN brinde_enabled BOOLEAN DEFAULT false;
  END IF;
  
  -- Adicionar coluna brinde_value se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sis_empresa' 
    AND column_name = 'brinde_value'
  ) THEN
    ALTER TABLE sis_empresa ADD COLUMN brinde_value NUMERIC(10,4) DEFAULT 0;
  END IF;
  
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_sis_empresa_brinde ON sis_empresa(brinde_enabled);


