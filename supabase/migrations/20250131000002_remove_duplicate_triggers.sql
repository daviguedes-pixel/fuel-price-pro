-- Remover triggers duplicados e conflitantes de notificações
-- Manter apenas o trigger mais recente (create_notification_on_approval_change)

DROP TRIGGER IF EXISTS trigger_create_notification_on_approval_change ON public.price_suggestions;
DROP TRIGGER IF EXISTS price_approved_notification ON public.price_suggestions;
DROP TRIGGER IF EXISTS price_rejected_notification ON public.price_suggestions;
DROP TRIGGER IF EXISTS price_suggestion_status_changed ON public.price_suggestions;
DROP TRIGGER IF EXISTS new_reference_notification ON public.referencias;

-- Remover funções antigas que não são mais usadas
DROP FUNCTION IF EXISTS public.notify_price_approved(UUID, TEXT);
DROP FUNCTION IF EXISTS public.notify_price_rejected(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.trigger_notify_price_approved();
DROP FUNCTION IF EXISTS public.notify_price_rejected();

-- Garantir que o trigger correto existe
CREATE TRIGGER trigger_create_notification_on_approval_change
AFTER UPDATE OF status ON public.price_suggestions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION create_notification_on_approval_change();

