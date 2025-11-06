-- Adicionar campo para armazenar a bandeira da origem do custo
ALTER TABLE public.price_suggestions 
ADD COLUMN IF NOT EXISTS price_origin_bandeira text;