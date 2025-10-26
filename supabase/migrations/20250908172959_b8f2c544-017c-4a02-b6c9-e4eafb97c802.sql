-- Create enum types
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'draft');
CREATE TYPE public.payment_type AS ENUM ('vista', 'cartao_28', 'cartao_35');
CREATE TYPE public.product_type AS ENUM ('etanol', 'gasolina_comum', 'gasolina_aditivada', 's10', 's500');
CREATE TYPE public.reference_type AS ENUM ('nf', 'print_portal', 'print_conversa', 'sem_referencia');

-- Create stations table
CREATE TABLE public.stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create payment_methods table
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type payment_type NOT NULL,
    fee_percentage DECIMAL(5,2) DEFAULT 0,
    days INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create price_suggestions table
CREATE TABLE public.price_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES public.stations(id),
    client_id UUID REFERENCES public.clients(id),
    product product_type NOT NULL,
    payment_method_id UUID REFERENCES public.payment_methods(id),
    cost_price DECIMAL(10,4) NOT NULL,
    margin_cents INTEGER NOT NULL, -- Store margin in cents
    final_price DECIMAL(10,4) NOT NULL,
    reference_type reference_type,
    observations TEXT,
    status approval_status DEFAULT 'draft',
    requested_by TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create price_history table
CREATE TABLE public.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID REFERENCES public.price_suggestions(id),
    station_id UUID REFERENCES public.stations(id),
    client_id UUID REFERENCES public.clients(id),
    product product_type NOT NULL,
    old_price DECIMAL(10,4),
    new_price DECIMAL(10,4) NOT NULL,
    margin_cents INTEGER NOT NULL,
    approved_by TEXT NOT NULL,
    change_type TEXT, -- 'up' or 'down'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default data
INSERT INTO public.stations (name, code, address) VALUES
('Posto Central', 'posto-central', 'Centro da cidade'),
('Posto Norte', 'posto-norte', 'Região Norte'),
('Posto Shopping', 'posto-shopping', 'Ao lado do shopping'),
('Posto Rodovia', 'posto-rodovia', 'Na rodovia principal');

INSERT INTO public.clients (name, code, contact_email) VALUES
('Transportadora ABC', 'transportadora-abc', 'contato@transportadoraabc.com'),
('Frota Express', 'frota-express', 'contato@frotaexpress.com'),
('Logística Sul', 'logistica-sul', 'contato@logisticasul.com');

INSERT INTO public.payment_methods (name, type, fee_percentage, days) VALUES
('À Vista', 'vista', 0, 0),
('Cartão 28 dias', 'cartao_28', 2.5, 28),
('Cartão 35 dias', 'cartao_35', 3.2, 35);

-- Enable RLS
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - should be restricted based on user roles)
CREATE POLICY "Enable all operations for authenticated users" ON public.stations FOR ALL USING (true);
CREATE POLICY "Enable all operations for authenticated users" ON public.clients FOR ALL USING (true);
CREATE POLICY "Enable all operations for authenticated users" ON public.payment_methods FOR ALL USING (true);
CREATE POLICY "Enable all operations for authenticated users" ON public.price_suggestions FOR ALL USING (true);
CREATE POLICY "Enable all operations for authenticated users" ON public.price_history FOR ALL USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_price_suggestions_updated_at BEFORE UPDATE ON public.price_suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();