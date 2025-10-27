-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'approved', 'rejected'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas suas próprias notificações
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Política para sistema criar notificações (users podem inserir para si mesmos ou outros)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Política para usuários marcarem suas notificações como lidas
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Função para criar notificação quando uma aprovação muda de status
CREATE OR REPLACE FUNCTION create_notification_on_approval_change()
RETURNS TRIGGER AS $$
DECLARE
  creator_user_id UUID;
  notification_message TEXT;
BEGIN
  -- Buscar o criador da solicitação
  SELECT created_by INTO creator_user_id
  FROM public.price_suggestions
  WHERE id = NEW.id;
  
  -- Só criar notificação se o status mudou para approved ou rejected
  IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    IF NEW.status = 'approved' THEN
      notification_message := 'Sua solicitação de preço foi aprovada!';
      INSERT INTO public.notifications (user_id, suggestion_id, type, title, message)
      VALUES (creator_user_id, NEW.id, NEW.status, 'Preço Aprovado', notification_message);
    ELSE
      notification_message := 'Sua solicitação de preço foi rejeitada.';
      INSERT INTO public.notifications (user_id, suggestion_id, type, title, message)
      VALUES (creator_user_id, NEW.id, NEW.status, 'Preço Rejeitado', notification_message);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para disparar quando status muda
DROP TRIGGER IF EXISTS trigger_create_notification_on_approval_change ON public.price_suggestions;
CREATE TRIGGER trigger_create_notification_on_approval_change
AFTER UPDATE OF status ON public.price_suggestions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION create_notification_on_approval_change();
