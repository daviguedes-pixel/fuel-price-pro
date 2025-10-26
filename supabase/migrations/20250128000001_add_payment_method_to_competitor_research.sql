-- Add payment_method field to competitor_research table
ALTER TABLE public.competitor_research 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_competitor_research_payment_method 
ON public.competitor_research(payment_method);

