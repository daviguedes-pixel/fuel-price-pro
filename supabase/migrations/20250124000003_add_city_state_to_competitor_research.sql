-- Adicionar campos city e state à tabela competitor_research
ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS state TEXT;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_competitor_research_city ON competitor_research(city);
CREATE INDEX IF NOT EXISTS idx_competitor_research_state ON competitor_research(state);
