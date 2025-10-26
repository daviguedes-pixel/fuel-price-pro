-- =====================================================
-- SISTEMA DE NOTIFICAÇÕES REAIS
-- =====================================================

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rate_expiry', 'approval_pending', 'price_approved', 'price_rejected', 'system', 'competitor_update', 'client_update')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  data JSONB, -- Dados adicionais específicos da notificação
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política para notificações: usuário só pode ver suas próprias notificações
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Política para marcar como lida
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para excluir notificações
CREATE POLICY "Users can delete own notifications" ON public.notifications
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Função para criar notificação
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, type, title, message, data, expires_at
  ) VALUES (
    p_user_id, p_type, p_title, p_message, p_data, p_expires_at
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Função para verificar taxas vencendo
CREATE OR REPLACE FUNCTION check_expiring_rates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rate_record RECORD;
  days_until_expiry INTEGER;
  notification_exists BOOLEAN;
BEGIN
  -- Verificar taxas negociadas que vencem em até 7 dias
  FOR rate_record IN 
    SELECT 
      tn.id,
      tn.client_id,
      tn.station_id,
      tn.product,
      tn.negotiated_price,
      tn.expiry_date,
      c.name as client_name,
      s.name as station_name,
      up.user_id
    FROM public.taxas_negociadas tn
    JOIN public.clients c ON tn.client_id = c.id
    JOIN public.stations s ON tn.station_id = s.id
    JOIN public.user_profiles up ON up.role IN ('admin', 'supervisor', 'gerente')
    WHERE tn.is_negotiated = true
      AND tn.expiry_date IS NOT NULL
      AND tn.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (rate_record.expiry_date - NOW()));
    
    -- Verificar se já existe notificação para esta taxa
    SELECT EXISTS(
      SELECT 1 FROM public.notifications 
      WHERE user_id = rate_record.user_id 
        AND type = 'rate_expiry'
        AND data->>'taxa_id' = rate_record.id::TEXT
        AND created_at > NOW() - INTERVAL '1 day'
    ) INTO notification_exists;
    
    -- Criar notificação se não existir
    IF NOT notification_exists THEN
      PERFORM create_notification(
        rate_record.user_id,
        'rate_expiry',
        'Taxa Vencendo',
        'A taxa negociada com ' || rate_record.client_name || ' (' || rate_record.station_name || ') vence em ' || days_until_expiry || ' dias',
        jsonb_build_object(
          'taxa_id', rate_record.id,
          'client_id', rate_record.client_id,
          'station_id', rate_record.station_id,
          'product', rate_record.product,
          'price', rate_record.negotiated_price,
          'expiry_date', rate_record.expiry_date,
          'days_until_expiry', days_until_expiry
        ),
        rate_record.expiry_date
      );
    END IF;
  END LOOP;
END;
$$;

-- Função para verificar aprovações pendentes
CREATE OR REPLACE FUNCTION check_pending_approvals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approval_record RECORD;
  pending_count INTEGER;
BEGIN
  -- Contar aprovações pendentes por usuário com permissão de aprovação
  FOR approval_record IN
    SELECT 
      up.user_id,
      COUNT(ps.id) as count
    FROM public.user_profiles up
    LEFT JOIN public.price_suggestions ps ON ps.status = 'pending'
    WHERE up.role IN ('admin', 'supervisor') 
      OR up.pode_acessar_aprovacao = true
    GROUP BY up.user_id
    HAVING COUNT(ps.id) > 0
  LOOP
    -- Verificar se já existe notificação recente
    IF NOT EXISTS(
      SELECT 1 FROM public.notifications 
      WHERE user_id = approval_record.user_id 
        AND type = 'approval_pending'
        AND created_at > NOW() - INTERVAL '1 hour'
    ) THEN
      PERFORM create_notification(
        approval_record.user_id,
        'approval_pending',
        'Aprovação Pendente',
        'Há ' || approval_record.count || ' solicitação(ões) de preço aguardando sua aprovação',
        jsonb_build_object(
          'pending_count', approval_record.count,
          'last_check', NOW()
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Função para criar notificação de preço aprovado
CREATE OR REPLACE FUNCTION notify_price_approved(
  p_suggestion_id UUID,
  p_approved_by TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  suggestion_record RECORD;
BEGIN
  -- Buscar dados da sugestão
  SELECT 
    ps.id,
    ps.requested_by,
    ps.final_price,
    ps.product,
    c.name as client_name,
    s.name as station_name
  INTO suggestion_record
  FROM public.price_suggestions ps
  LEFT JOIN public.clients c ON ps.client_id = c.id
  LEFT JOIN public.stations s ON ps.station_id = s.id
  WHERE ps.id = p_suggestion_id;
  
  IF suggestion_record.id IS NOT NULL THEN
    -- Buscar user_id do solicitante
    PERFORM create_notification(
      (SELECT user_id FROM public.user_profiles WHERE email = suggestion_record.requested_by LIMIT 1),
      'price_approved',
      'Preço Aprovado',
      'Sua solicitação de preço #' || suggestion_record.id::TEXT || ' foi aprovada por ' || p_approved_by,
      jsonb_build_object(
        'suggestion_id', suggestion_record.id,
        'approved_by', p_approved_by,
        'final_price', suggestion_record.final_price,
        'product', suggestion_record.product,
        'client_name', suggestion_record.client_name,
        'station_name', suggestion_record.station_name
      )
    );
  END IF;
END;
$$;

-- Função para criar notificação de preço rejeitado
CREATE OR REPLACE FUNCTION notify_price_rejected(
  p_suggestion_id UUID,
  p_rejected_by TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  suggestion_record RECORD;
BEGIN
  -- Buscar dados da sugestão
  SELECT 
    ps.id,
    ps.requested_by,
    ps.final_price,
    ps.product,
    c.name as client_name,
    s.name as station_name
  INTO suggestion_record
  FROM public.price_suggestions ps
  LEFT JOIN public.clients c ON ps.client_id = c.id
  LEFT JOIN public.stations s ON ps.station_id = s.id
  WHERE ps.id = p_suggestion_id;
  
  IF suggestion_record.id IS NOT NULL THEN
    -- Buscar user_id do solicitante
    PERFORM create_notification(
      (SELECT user_id FROM public.user_profiles WHERE email = suggestion_record.requested_by LIMIT 1),
      'price_rejected',
      'Preço Rejeitado',
      'Sua solicitação de preço #' || suggestion_record.id::TEXT || ' foi rejeitada por ' || p_rejected_by || 
      CASE WHEN p_reason IS NOT NULL THEN '. Motivo: ' || p_reason ELSE '' END,
      jsonb_build_object(
        'suggestion_id', suggestion_record.id,
        'rejected_by', p_rejected_by,
        'reason', p_reason,
        'final_price', suggestion_record.final_price,
        'product', suggestion_record.product,
        'client_name', suggestion_record.client_name,
        'station_name', suggestion_record.station_name
      )
    );
  END IF;
END;
$$;

-- Trigger para notificar quando preço é aprovado
CREATE OR REPLACE FUNCTION trigger_notify_price_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    PERFORM notify_price_approved(NEW.id, NEW.approved_by);
  END IF;
  
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    PERFORM notify_price_rejected(NEW.id, NEW.approved_by, NEW.observations);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER price_suggestion_status_changed
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_price_approved();

-- Função para limpar notificações expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$;

-- Comentários para documentação
COMMENT ON TABLE public.notifications IS 'Sistema de notificações em tempo real para usuários';
COMMENT ON FUNCTION create_notification IS 'Cria uma nova notificação para um usuário';
COMMENT ON FUNCTION check_expiring_rates IS 'Verifica e cria notificações para taxas vencendo';
COMMENT ON FUNCTION check_pending_approvals IS 'Verifica e cria notificações para aprovações pendentes';
COMMENT ON FUNCTION notify_price_approved IS 'Cria notificação quando preço é aprovado';
COMMENT ON FUNCTION notify_price_rejected IS 'Cria notificação quando preço é rejeitado';
COMMENT ON FUNCTION cleanup_expired_notifications IS 'Remove notificações expiradas';

-- =====================================================
-- FIM DO SISTEMA DE NOTIFICAÇÕES
-- =====================================================
