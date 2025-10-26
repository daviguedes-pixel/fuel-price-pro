-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- Create RLS policies for attachments bucket
CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their attachments" ON storage.objects FOR UPDATE USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their attachments" ON storage.objects FOR DELETE USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

-- Add attachments column to price_suggestions
ALTER TABLE public.price_suggestions ADD COLUMN attachments TEXT[];

-- Add attachments column to research (will create this table)
CREATE TABLE public.competitor_research (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_name TEXT NOT NULL,
    address TEXT,
    product product_type NOT NULL,
    price DECIMAL(10,4) NOT NULL,
    date_observed TIMESTAMP WITH TIME ZONE NOT NULL,
    attachments TEXT[],
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for competitor_research
ALTER TABLE public.competitor_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users" ON public.competitor_research FOR ALL USING (true);

-- Add trigger for competitor_research updated_at
CREATE TRIGGER update_competitor_research_updated_at BEFORE UPDATE ON public.competitor_research FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();