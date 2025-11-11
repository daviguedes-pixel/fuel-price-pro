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
            // Tocar som de notificação
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzGF0fPTgjMIGmW57+OcTQ8OUKXj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQcxhdHz04IzCBplue/jnE0PDlCl4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC');
              audio.volume = 0.5;
              audio.play().catch(e => console.log('Erro ao tocar som:', e));
            } catch (e) {
              // Fallback: usar beep do navegador
              try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
              } catch (audioError) {
                console.log('Erro ao tocar som de notificação:', audioError);
              }
            }
            
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
