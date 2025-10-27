-- Remover trigger problemático
DROP TRIGGER IF EXISTS trigger_create_notification_on_approval_change ON public.price_suggestions;
DROP FUNCTION IF EXISTS create_notification_on_approval_change();

-- As notificações serão criadas manualmente pelo frontend quando aprovar/rejeitar
-- Isso evita problemas de tipo (UUID vs TEXT) no COALESCE

