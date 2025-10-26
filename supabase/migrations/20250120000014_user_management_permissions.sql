-- Migração para gerenciamento de usuários e permissões
-- Criar tabelas para controle de acesso e vinculação de postos

-- Tabela para gerenciar abas que usuários podem acessar
CREATE TABLE IF NOT EXISTS user_tab_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_name TEXT NOT NULL, -- nome da aba (dashboard, approvals, research, etc.)
  can_access BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tab_name)
);

-- Tabela para vincular usuários a postos específicos (gerentes)
CREATE TABLE IF NOT EXISTS user_station_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL, -- ID do posto da tabela sis_empresa
  station_name TEXT NOT NULL, -- Nome do posto para referência
  access_level TEXT DEFAULT 'manager', -- manager, viewer, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, station_id)
);

-- Tabela para logs de ações administrativas
CREATE TABLE IF NOT EXISTS admin_actions_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'delete_approval', 'change_permissions', 'assign_station', etc.
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id TEXT, -- ID do item afetado (aprovação, usuário, etc.)
  description TEXT NOT NULL,
  metadata JSONB, -- dados adicionais da ação
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_user_tab_permissions_updated_at 
  BEFORE UPDATE ON user_tab_permissions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_station_access_updated_at 
  BEFORE UPDATE ON user_station_access 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE user_tab_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_station_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Políticas para user_tab_permissions
CREATE POLICY "Users can view their own tab permissions" ON user_tab_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tab permissions" ON user_tab_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND perfil = 'admin'
    )
  );

-- Políticas para user_station_access
CREATE POLICY "Users can view their own station access" ON user_station_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all station access" ON user_station_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND perfil = 'admin'
    )
  );

-- Políticas para admin_actions_log
CREATE POLICY "Admins can view all admin actions" ON admin_actions_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND perfil = 'admin'
    )
  );

CREATE POLICY "Admins can insert admin actions" ON admin_actions_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND perfil = 'admin'
    )
  );

-- Inserir permissões padrão para admin
INSERT INTO user_tab_permissions (user_id, tab_name, can_access, can_create, can_edit, can_delete)
SELECT 
  u.id,
  tab_name,
  true,
  true,
  true,
  true
FROM auth.users u
CROSS JOIN (
  VALUES 
    ('dashboard'),
    ('approvals'),
    ('research'),
    ('references'),
    ('price_request'),
    ('price_history'),
    ('rate_management'),
    ('client_management'),
    ('audit_logs'),
    ('admin')
) AS tabs(tab_name)
WHERE EXISTS (
  SELECT 1 FROM user_profiles p 
  WHERE p.user_id = u.id 
  AND p.perfil = 'admin'
)
ON CONFLICT (user_id, tab_name) DO NOTHING;

-- Função para deletar aprovações (com log)
CREATE OR REPLACE FUNCTION delete_price_approval(
  approval_id UUID,
  admin_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  approval_data RECORD;
BEGIN
  -- Buscar dados da aprovação antes de deletar
  SELECT * INTO approval_data 
  FROM price_suggestions 
  WHERE id = approval_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Deletar a aprovação
  DELETE FROM price_suggestions WHERE id = approval_id;
  
  -- Log da ação
  INSERT INTO admin_actions_log (
    admin_user_id,
    action_type,
    target_id,
    description,
    metadata
  ) VALUES (
    admin_user_id,
    'delete_approval',
    approval_id::TEXT,
    'Aprovação de preço deletada pelo admin',
    jsonb_build_object(
      'station_id', approval_data.station_id,
      'client_id', approval_data.client_id,
      'product', approval_data.product,
      'final_price', approval_data.final_price,
      'status', approval_data.status,
      'created_at', approval_data.created_at
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerenciar permissões de abas
CREATE OR REPLACE FUNCTION manage_user_tab_permissions(
  target_user_id UUID,
  tab_name TEXT,
  can_access BOOLEAN DEFAULT NULL,
  can_create BOOLEAN DEFAULT NULL,
  can_edit BOOLEAN DEFAULT NULL,
  can_delete BOOLEAN DEFAULT NULL,
  admin_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário que está fazendo a alteração é admin
  IF admin_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = admin_user_id 
    AND perfil = 'admin'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Inserir ou atualizar permissões
  INSERT INTO user_tab_permissions (
    user_id, tab_name, can_access, can_create, can_edit, can_delete
  ) VALUES (
    target_user_id, tab_name, 
    COALESCE(can_access, false),
    COALESCE(can_create, false),
    COALESCE(can_edit, false),
    COALESCE(can_delete, false)
  )
  ON CONFLICT (user_id, tab_name) 
  DO UPDATE SET
    can_access = COALESCE(EXCLUDED.can_access, user_tab_permissions.can_access),
    can_create = COALESCE(EXCLUDED.can_create, user_tab_permissions.can_create),
    can_edit = COALESCE(EXCLUDED.can_edit, user_tab_permissions.can_edit),
    can_delete = COALESCE(EXCLUDED.can_delete, user_tab_permissions.can_delete),
    updated_at = NOW();
  
  -- Log da ação se for admin
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO admin_actions_log (
      admin_user_id,
      action_type,
      target_user_id,
      description,
      metadata
    ) VALUES (
      admin_user_id,
      'change_permissions',
      target_user_id,
      'Permissões de aba alteradas pelo admin',
      jsonb_build_object(
        'tab_name', tab_name,
        'can_access', can_access,
        'can_create', can_create,
        'can_edit', can_edit,
        'can_delete', can_delete
      )
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para vincular usuário a postos
CREATE OR REPLACE FUNCTION assign_user_to_stations(
  target_user_id UUID,
  station_ids TEXT[],
  access_level TEXT DEFAULT 'manager',
  admin_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  station_id TEXT;
  station_name TEXT;
BEGIN
  -- Verificar se o usuário que está fazendo a alteração é admin
  IF admin_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = admin_user_id 
    AND perfil = 'admin'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Remover vinculações existentes
  DELETE FROM user_station_access WHERE user_id = target_user_id;
  
  -- Adicionar novas vinculações
  FOREACH station_id IN ARRAY station_ids
  LOOP
    -- Buscar nome do posto
    SELECT nome INTO station_name 
    FROM sis_empresa 
    WHERE id::TEXT = station_id OR codigo::TEXT = station_id;
    
    IF station_name IS NULL THEN
      station_name = 'Posto ' || station_id;
    END IF;
    
    INSERT INTO user_station_access (
      user_id, station_id, station_name, access_level
    ) VALUES (
      target_user_id, station_id, station_name, access_level
    );
  END LOOP;
  
  -- Log da ação se for admin
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO admin_actions_log (
      admin_user_id,
      action_type,
      target_user_id,
      description,
      metadata
    ) VALUES (
      admin_user_id,
      'assign_station',
      target_user_id,
      'Usuário vinculado a postos pelo admin',
      jsonb_build_object(
        'station_ids', station_ids,
        'access_level', access_level,
        'stations_count', array_length(station_ids, 1)
      )
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
