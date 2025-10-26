-- Criar tabela de permissões de perfil
CREATE TABLE IF NOT EXISTS public.profile_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil TEXT NOT NULL UNIQUE,
  
  -- Abas do sistema
  dashboard BOOLEAN NOT NULL DEFAULT true,
  price_request BOOLEAN NOT NULL DEFAULT true,
  approvals BOOLEAN NOT NULL DEFAULT false,
  research BOOLEAN NOT NULL DEFAULT false,
  map BOOLEAN NOT NULL DEFAULT false,
  price_history BOOLEAN NOT NULL DEFAULT false,
  reference_registration BOOLEAN NOT NULL DEFAULT false,
  admin BOOLEAN NOT NULL DEFAULT false,
  
  -- Ações
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_register BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_view_history BOOLEAN NOT NULL DEFAULT true,
  can_manage_notifications BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para todos autenticados
CREATE POLICY "Anyone can view profile permissions"
ON public.profile_permissions
FOR SELECT
TO authenticated
USING (true);

-- Apenas admins podem atualizar
CREATE POLICY "Admins can update profile permissions"
ON public.profile_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND (perfil = 'diretor_comercial' OR perfil = 'diretor_pricing' OR email = 'davi.guedes@redesaoroque.com.br')
  )
);

-- Inserir permissões padrão para cada perfil
INSERT INTO public.profile_permissions (perfil, dashboard, price_request, approvals, research, map, price_history, reference_registration, admin, can_approve, can_register, can_edit, can_delete, can_view_history, can_manage_notifications)
VALUES 
  ('diretor_comercial', true, true, true, true, true, true, true, true, true, true, true, true, true, true),
  ('supervisor_comercial', true, true, true, true, true, true, true, false, true, true, true, false, true, false),
  ('assessor_comercial', true, true, false, false, true, true, false, false, false, true, false, false, true, false),
  ('diretor_pricing', true, true, true, true, true, true, true, true, true, true, true, true, true, true),
  ('analista_pricing', true, true, false, true, true, true, true, false, false, true, true, false, true, false),
  ('gerente', true, true, false, true, true, true, false, false, false, true, false, false, true, false)
ON CONFLICT (perfil) DO NOTHING;