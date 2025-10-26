-- Adicionar campos de latitude e longitude à tabela competitor_research
ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_competitor_research_latitude ON competitor_research(latitude);
CREATE INDEX IF NOT EXISTS idx_competitor_research_longitude ON competitor_research(longitude);
