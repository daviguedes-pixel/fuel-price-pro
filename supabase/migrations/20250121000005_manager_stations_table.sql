-- Tabela para vincular gerentes aos postos (opcional)
CREATE TABLE IF NOT EXISTS manager_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(manager_id, station_id)
);

-- RLS para manager_stations
ALTER TABLE manager_stations ENABLE ROW LEVEL SECURITY;

-- Política: Gerentes só podem ver seus próprios postos
CREATE POLICY "Managers can view their own stations" ON manager_stations
  FOR SELECT USING (auth.uid() = manager_id);

-- Política: Admins podem gerenciar todas as vinculações
CREATE POLICY "Admins can manage all station assignments" ON manager_stations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND perfil = 'admin'
    )
  );

-- Política: Gerentes podem criar vinculações para si mesmos
CREATE POLICY "Managers can assign stations to themselves" ON manager_stations
  FOR INSERT WITH CHECK (auth.uid() = manager_id);

-- Política: Gerentes podem remover suas próprias vinculações
CREATE POLICY "Managers can remove their own station assignments" ON manager_stations
  FOR DELETE USING (auth.uid() = manager_id);
