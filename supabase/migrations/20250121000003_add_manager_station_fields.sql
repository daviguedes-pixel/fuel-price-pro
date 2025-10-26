-- Adicionar campo manager_id para vincular postos ao gerente
ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id);

-- Adicionar campo station_id para identificar o posto
ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS station_id TEXT;

-- Adicionar campo station_type para distinguir concorrente/proprio
ALTER TABLE competitor_research 
ADD COLUMN IF NOT EXISTS station_type TEXT DEFAULT 'concorrente';

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_competitor_research_manager_id ON competitor_research(manager_id);
CREATE INDEX IF NOT EXISTS idx_competitor_research_station_id ON competitor_research(station_id);
CREATE INDEX IF NOT EXISTS idx_competitor_research_station_type ON competitor_research(station_type);
