import { useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function RealtimeNotifications() {
  const { refresh } = useNotifications();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Configurar subscription para notificações em tempo real
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new;
          
          // Mostrar toast para notificações não lidas
          if (!notification.read) {
            toast.info(notification.title || 'Nova notificação', {
              description: notification.message,
              duration: 5000,
              action: {
                label: 'Ver',
                onClick: () => {
                  // Abrir centro de notificações
                  const bellButton = document.querySelector('[data-notification-bell]') as HTMLElement;
                  if (bellButton) {
                    bellButton.click();
                  }
                }
              }
            });
          }

          // Recarregar notificações
          refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Recarregar notificações quando atualizadas
          refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Recarregar notificações quando deletadas
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return null; // Este componente não renderiza nada visual
}

export default RealtimeNotifications;
