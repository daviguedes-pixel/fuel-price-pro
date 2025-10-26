-- Criar postos reais baseados nas empresas da cotação
-- Limpar postos de teste primeiro
DELETE FROM public.stations 
WHERE code IN ('posto-central', 'posto-norte', 'posto-shopping', 'posto-rodovia');

-- Inserir postos reais das empresas da cotação
INSERT INTO public.stations (name, code, address, active) VALUES
  ('Posto São Roque Cerradão', '1062982', 'Endereço não especificado', true),
  ('Posto São Roque Comodoro', '1099993', 'Endereço não especificado', true),
  ('Rodotruck Castilho', '813932469', 'Endereço não especificado', true),
  ('Auto Posto Sof Norte', '122998', 'Endereço não especificado', true),
  ('Comelli Combustíveis', '1052938', 'Endereço não especificado', true),
  ('Coringa QI09', '32965877000101', 'Endereço não especificado', true),
  ('Posto Itiquira MT', '1102904', 'Endereço não especificado', true),
  ('Posto Caminhoneiro 020', '1111824', 'Endereço não especificado', true),
  ('Posto Du Figueiredo', '1040248', 'Endereço não especificado', true),
  ('Posto Tigre 163', '1090758', 'Endereço não especificado', true)
ON CONFLICT DO NOTHING;