-- Integração de notificações por email com triggers

-- Função para enviar email quando preço é aprovado
CREATE OR REPLACE FUNCTION public.send_price_approved_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  client_name TEXT;
  station_name TEXT;
BEGIN
  -- Verificar se email está habilitado
  IF NOT EXISTS (
    SELECT 1 FROM public.email_settings 
    WHERE enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Obter email do usuário que solicitou
  SELECT email INTO user_email
  FROM auth.users 
  WHERE email = NEW.requested_by 
  LIMIT 1;

  -- Obter nome do cliente
  SELECT name INTO client_name
  FROM public.clients 
  WHERE id = NEW.client_id;

  -- Obter nome do posto
  SELECT name INTO station_name
  FROM public.stations 
  WHERE id = NEW.station_id;

  -- Enviar email se tudo estiver disponível
  IF user_email IS NOT NULL AND client_name IS NOT NULL AND station_name IS NOT NULL THEN
    -- Registrar tentativa de envio de email
    INSERT INTO public.email_logs (
      to_email,
      subject,
      template_id,
      status
    ) VALUES (
      user_email,
      'Preço Aprovado - ' || client_name,
      (SELECT id FROM public.email_templates WHERE name = 'price_approved' LIMIT 1),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para enviar email quando preço é rejeitado
CREATE OR REPLACE FUNCTION public.send_price_rejected_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  client_name TEXT;
  station_name TEXT;
BEGIN
  -- Verificar se email está habilitado
  IF NOT EXISTS (
    SELECT 1 FROM public.email_settings 
    WHERE enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Obter email do usuário que solicitou
  SELECT email INTO user_email
  FROM auth.users 
  WHERE email = NEW.requested_by 
  LIMIT 1;

  -- Obter nome do cliente
  SELECT name INTO client_name
  FROM public.clients 
  WHERE id = NEW.client_id;

  -- Obter nome do posto
  SELECT name INTO station_name
  FROM public.stations 
  WHERE id = NEW.station_id;

  -- Enviar email se tudo estiver disponível
  IF user_email IS NOT NULL AND client_name IS NOT NULL AND station_name IS NOT NULL THEN
    -- Registrar tentativa de envio de email
    INSERT INTO public.email_logs (
      to_email,
      subject,
      template_id,
      status
    ) VALUES (
      user_email,
      'Preço Rejeitado - ' || client_name,
      (SELECT id FROM public.email_templates WHERE name = 'price_rejected' LIMIT 1),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para enviar email quando nova referência é criada
CREATE OR REPLACE FUNCTION public.send_new_reference_email()
RETURNS TRIGGER AS $$
DECLARE
  client_name TEXT;
  station_name TEXT;
  created_by_email TEXT;
BEGIN
  -- Verificar se email está habilitado
  IF NOT EXISTS (
    SELECT 1 FROM public.email_settings 
    WHERE enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Obter nome do cliente
  SELECT name INTO client_name
  FROM public.clients 
  WHERE id = NEW.cliente_id;

  -- Obter nome do posto
  SELECT name INTO station_name
  FROM public.stations 
  WHERE id = NEW.posto_id;

  -- Obter email do usuário que criou
  SELECT email INTO created_by_email
  FROM auth.users 
  WHERE id = NEW.criado_por 
  LIMIT 1;

  -- Enviar email para usuários com permissão se tudo estiver disponível
  IF client_name IS NOT NULL AND station_name IS NOT NULL THEN
    -- Registrar tentativa de envio de email para usuários com permissão
    INSERT INTO public.email_logs (
      to_email,
      subject,
      template_id,
      status
    )
    SELECT 
      u.email,
      'Nova Referência Cadastrada',
      (SELECT id FROM public.email_templates WHERE name = 'new_reference' LIMIT 1),
      'pending'
    FROM public.user_profiles up
    JOIN auth.users u ON u.id = up.user_id
    WHERE up.pode_acessar_cadastro_referencia = true
    AND u.email IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar triggers existentes para incluir emails
DROP TRIGGER IF EXISTS price_approved_notification ON public.price_suggestions;
CREATE TRIGGER price_approved_notification
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_price_approved();

DROP TRIGGER IF EXISTS price_approved_email ON public.price_suggestions;
CREATE TRIGGER price_approved_email
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.send_price_approved_email();

DROP TRIGGER IF EXISTS price_rejected_notification ON public.price_suggestions;
CREATE TRIGGER price_rejected_notification
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_price_rejected();

DROP TRIGGER IF EXISTS price_rejected_email ON public.price_suggestions;
CREATE TRIGGER price_rejected_email
  AFTER UPDATE ON public.price_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.send_price_rejected_email();

DROP TRIGGER IF EXISTS new_reference_notification ON public.referencias;
CREATE TRIGGER new_reference_notification
  AFTER INSERT ON public.referencias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_reference();

DROP TRIGGER IF EXISTS new_reference_email ON public.referencias;
CREATE TRIGGER new_reference_email
  AFTER INSERT ON public.referencias
  FOR EACH ROW
  EXECUTE FUNCTION public.send_new_reference_email();

-- Função para processar emails pendentes (para ser chamada por job/cron)
CREATE OR REPLACE FUNCTION public.process_pending_emails()
RETURNS INTEGER AS $$
DECLARE
  email_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Processar emails pendentes
  FOR email_record IN 
    SELECT el.*, et.body_html, et.body_text, et.subject as template_subject
    FROM public.email_logs el
    JOIN public.email_templates et ON et.id = el.template_id
    WHERE el.status = 'pending'
    ORDER BY el.created_at ASC
    LIMIT 10
  LOOP
    -- Aqui você implementaria a lógica real de envio de email
    -- Por enquanto, vamos simular o envio
    
    -- Simular sucesso/erro baseado em alguma condição
    IF email_record.to_email LIKE '%@%' THEN
      -- Simular sucesso
      UPDATE public.email_logs 
      SET 
        status = 'sent',
        sent_at = now()
      WHERE id = email_record.id;
      
      processed_count := processed_count + 1;
    ELSE
      -- Simular erro
      UPDATE public.email_logs 
      SET 
        status = 'failed',
        error_message = 'Email inválido'
      WHERE id = email_record.id;
    END IF;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas de email
CREATE OR REPLACE FUNCTION public.get_email_stats()
RETURNS TABLE (
  total_emails BIGINT,
  sent_emails BIGINT,
  failed_emails BIGINT,
  pending_emails BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_emails,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_emails,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_emails
  FROM public.email_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
