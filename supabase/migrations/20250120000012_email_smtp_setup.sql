-- Configuração de SMTP para envio de emails
-- Esta migration configura o sistema de email usando SMTP do Supabase

-- Função para enviar email via SMTP
CREATE OR REPLACE FUNCTION send_email(
  to_email TEXT,
  subject TEXT,
  body_html TEXT DEFAULT NULL,
  body_text TEXT DEFAULT NULL,
  from_email TEXT DEFAULT 'noreply@saoroquerede.com.br',
  from_name TEXT DEFAULT 'São Roque Rede'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Usar a função de email do Supabase
  SELECT auth.email_send_email(
    to_email,
    subject,
    body_html,
    body_text,
    from_email,
    from_name
  ) INTO result;
  
  -- Registrar o envio no log
  INSERT INTO email_logs (
    to_email,
    subject,
    template_id,
    status,
    sent_at
  ) VALUES (
    to_email,
    subject,
    NULL,
    CASE WHEN result->>'success' = 'true' THEN 'sent' ELSE 'failed' END,
    NOW()
  );
  
  RETURN result;
END;
$$;

-- Função para enviar email usando template
CREATE OR REPLACE FUNCTION send_email_template(
  to_email TEXT,
  template_name TEXT,
  variables JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_record RECORD;
  subject TEXT;
  body_html TEXT;
  body_text TEXT;
  result JSON;
  key TEXT;
  value TEXT;
BEGIN
  -- Buscar template
  SELECT * INTO template_record
  FROM email_templates
  WHERE name = template_name AND active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Template não encontrado');
  END IF;
  
  -- Preparar conteúdo
  subject := template_record.subject;
  body_html := template_record.body_html;
  body_text := template_record.body_text;
  
  -- Substituir variáveis
  FOR key, value IN SELECT * FROM jsonb_each_text(variables) LOOP
    subject := replace(subject, '{{' || key || '}}', value);
    body_html := replace(body_html, '{{' || key || '}}', value);
    body_text := replace(body_text, '{{' || key || '}}', value);
  END LOOP;
  
  -- Enviar email
  SELECT send_email(to_email, subject, body_html, body_text) INTO result;
  
  RETURN result;
END;
$$;

-- Configurações padrão de email
INSERT INTO email_settings (
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_password,
  smtp_secure,
  from_email,
  from_name,
  enabled
) VALUES (
  'smtp.supabase.com',
  587,
  'noreply@saoroquerede.com.br',
  '', -- Senha será configurada no dashboard do Supabase
  true,
  'noreply@saoroquerede.com.br',
  'São Roque Rede',
  true
) ON CONFLICT (id) DO UPDATE SET
  smtp_host = EXCLUDED.smtp_host,
  smtp_port = EXCLUDED.smtp_port,
  smtp_user = EXCLUDED.smtp_user,
  smtp_secure = EXCLUDED.smtp_secure,
  from_email = EXCLUDED.from_email,
  from_name = EXCLUDED.from_name,
  enabled = EXCLUDED.enabled;

-- Templates de email padrão
INSERT INTO email_templates (name, subject, body_html, body_text, variables, active) VALUES
(
  'price_approval',
  'Solicitação de Preço Aprovada - {{station_name}}',
  '<h2>Solicitação de Preço Aprovada</h2>
  <p>Olá {{client_name}},</p>
  <p>Sua solicitação de preço para o posto <strong>{{station_name}}</strong> foi aprovada.</p>
  <p><strong>Produto:</strong> {{product}}</p>
  <p><strong>Preço Aprovado:</strong> {{approved_price}}</p>
  <p><strong>Data:</strong> {{approval_date}}</p>
  <p>Atenciosamente,<br>Equipe São Roque Rede</p>',
  'Solicitação de Preço Aprovada

Olá {{client_name}},

Sua solicitação de preço para o posto {{station_name}} foi aprovada.

Produto: {{product}}
Preço Aprovado: {{approved_price}}
Data: {{approval_date}}

Atenciosamente,
Equipe São Roque Rede',
  ARRAY['client_name', 'station_name', 'product', 'approved_price', 'approval_date'],
  true
),
(
  'price_rejection',
  'Solicitação de Preço Negada - {{station_name}}',
  '<h2>Solicitação de Preço Negada</h2>
  <p>Olá {{client_name}},</p>
  <p>Sua solicitação de preço para o posto <strong>{{station_name}}</strong> foi negada.</p>
  <p><strong>Produto:</strong> {{product}}</p>
  <p><strong>Motivo:</strong> {{rejection_reason}}</p>
  <p><strong>Data:</strong> {{rejection_date}}</p>
  <p>Atenciosamente,<br>Equipe São Roque Rede</p>',
  'Solicitação de Preço Negada

Olá {{client_name}},

Sua solicitação de preço para o posto {{station_name}} foi negada.

Produto: {{product}}
Motivo: {{rejection_reason}}
Data: {{rejection_date}}

Atenciosamente,
Equipe São Roque Rede',
  ARRAY['client_name', 'station_name', 'product', 'rejection_reason', 'rejection_date'],
  true
),
(
  'new_reference',
  'Nova Referência Cadastrada - {{station_name}}',
  '<h2>Nova Referência Cadastrada</h2>
  <p>Uma nova referência foi cadastrada para o posto <strong>{{station_name}}</strong>.</p>
  <p><strong>Produto:</strong> {{product}}</p>
  <p><strong>Preço de Referência:</strong> {{reference_price}}</p>
  <p><strong>Data:</strong> {{reference_date}}</p>
  <p>Atenciosamente,<br>Equipe São Roque Rede</p>',
  'Nova Referência Cadastrada

Uma nova referência foi cadastrada para o posto {{station_name}}.

Produto: {{product}}
Preço de Referência: {{reference_price}}
Data: {{reference_date}}

Atenciosamente,
Equipe São Roque Rede',
  ARRAY['station_name', 'product', 'reference_price', 'reference_date'],
  true
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  variables = EXCLUDED.variables,
  active = EXCLUDED.active;
