import { createContext, useContext, ReactNode } from 'react';

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
  return (
    <NotificationsContext.Provider value={{
      notifications: [],
      unreadCount: 0,
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      deleteNotification: async () => {},
      refresh: async () => {},
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
