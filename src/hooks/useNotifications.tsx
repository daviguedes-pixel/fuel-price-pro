// @ts-nocheck
import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  suggestion_id?: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

interface NotificationsContextType {
  notifications: any[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  refresh: async () => {},
});

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      console.log('⚠️ Usuário não autenticado, não carregando notificações');
      return;
    }

    console.log('🔄 Carregando notificações para user_id:', user.id);

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Se a tabela não existe, apenas logar e retornar array vazio
        if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
          console.warn('📋 Tabela de notificações ainda não foi criada. Execute o arquivo apply_notifications.sql no Supabase Dashboard.');
          setNotifications([]);
          return;
        }
        
        console.error('❌ Erro ao carregar notificações:', {
          error,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          userId: user.id
        });
        throw error;
      }
      
      console.log('📬 Notificações carregadas:', {
        total: data?.length || 0,
        unread: data?.filter((n: Notification) => !n.read).length || 0,
        userId: user.id,
        notifications: data?.map((n: Notification) => ({ 
          id: n.id, 
          read: n.read, 
          type: n.type, 
          title: n.title,
          user_id: (n as any).user_id 
        }))
      });
      
      setNotifications(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar notificações:', error);
      setNotifications([]);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    
    // Escutar evento customizado para refresh quando notificação for criada
    const handleNotificationCreated = () => {
      console.log('🔄 Evento de notificação criada recebido, recarregando...');
      loadNotifications();
    };
    
    window.addEventListener('notification-created', handleNotificationCreated);
    
    return () => {
      window.removeEventListener('notification-created', handleNotificationCreated);
    };
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) {
        if (error.code !== 'PGRST205') throw error;
        return;
      }
      loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        if (error.code !== 'PGRST205') throw error;
        return;
      }
      loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code !== 'PGRST205') throw error;
        return;
      }
      loadNotifications();
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Debug: log do contador de não lidas
  useEffect(() => {
    console.log('🔔 Notificações:', {
      total: notifications.length,
      unread: unreadCount,
      notifications: notifications.map(n => ({ id: n.id, read: n.read, title: n.title }))
    });
  }, [notifications, unreadCount]);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refresh: loadNotifications,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
