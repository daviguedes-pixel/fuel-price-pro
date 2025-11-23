-- =====================================================
-- ADICIONAR PUSH NOTIFICATIONS AOS TRIGGERS
-- =====================================================

-- Modificar função create_notification para incluir dados necessários para push
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
  
  -- Nota: Push notifications serão enviadas pelo cliente via RealtimeNotifications
  -- quando a notificação for inserida na tabela
  
  RETURN notification_id;
END;
$$;

-- Modificar função notify_price_approved para incluir URL
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
        'station_name', suggestion_record.station_name,
        'url', '/approvals'
      )
    );
  END IF;
END;
$$;

-- Modificar função notify_price_rejected para incluir URL
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
        'station_name', suggestion_record.station_name,
        'url', '/approvals'
      )
    );
  END IF;
END;
$$;

-- Modificar função check_pending_approvals para incluir URL
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
          'last_check', NOW(),
          'url', '/approvals'
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Modificar função check_expiring_rates para incluir URL
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
          'days_until_expiry', days_until_expiry,
          'url', '/dashboard'
        ),
        rate_record.expiry_date
      );
    END IF;
  END LOOP;
END;
$$;

