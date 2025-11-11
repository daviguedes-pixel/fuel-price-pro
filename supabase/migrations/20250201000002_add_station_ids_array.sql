-- Adicionar campo station_ids como array JSON para suportar múltiplos postos
ALTER TABLE public.price_suggestions 
ADD COLUMN IF NOT EXISTS station_ids jsonb DEFAULT '[]'::jsonb;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_price_suggestions_station_ids ON public.price_suggestions USING GIN (station_ids);

-- Migrar dados existentes: se station_id existe, adicionar ao array station_ids
UPDATE public.price_suggestions
SET station_ids = CASE 
  WHEN station_id IS NOT NULL AND station_id != '' THEN 
    jsonb_build_array(station_id)
  ELSE 
    '[]'::jsonb
END
WHERE station_ids IS NULL OR station_ids = '[]'::jsonb;

