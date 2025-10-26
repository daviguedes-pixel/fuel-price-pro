-- Ajuste temporário para testes: permitir IDs de postos/clientes como TEXT em price_suggestions
ALTER TABLE public.price_suggestions 
  DROP CONSTRAINT IF EXISTS price_suggestions_station_id_fkey,
  DROP CONSTRAINT IF EXISTS price_suggestions_client_id_fkey;

ALTER TABLE public.price_suggestions 
  ALTER COLUMN station_id TYPE TEXT USING station_id::TEXT,
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

CREATE INDEX IF NOT EXISTS idx_price_suggestions_station_id ON public.price_suggestions(station_id);
CREATE INDEX IF NOT EXISTS idx_price_suggestions_client_id ON public.price_suggestions(client_id);