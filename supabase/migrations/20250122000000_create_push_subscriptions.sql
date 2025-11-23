-- =====================================================
-- TABELA PARA ARMAZENAR TOKENS FCM (Firebase Cloud Messaging)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fcm_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: usuário só pode ver seus próprios tokens
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Política: usuário pode inserir seus próprios tokens
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política: usuário pode atualizar seus próprios tokens
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: usuário pode deletar seus próprios tokens
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token ON public.push_subscriptions(fcm_token);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- Comentários
COMMENT ON TABLE public.push_subscriptions IS 'Armazena tokens FCM para notificações push do Google';
COMMENT ON COLUMN public.push_subscriptions.fcm_token IS 'Token FCM do Firebase Cloud Messaging';
COMMENT ON COLUMN public.push_subscriptions.device_info IS 'Informações do dispositivo (user agent, plataforma, etc)';

