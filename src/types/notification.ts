/**
 * Tipos para notificações
 */

export type NotificationType = 
  | 'rate_expiry' 
  | 'approval_pending' 
  | 'price_approved' 
  | 'price_rejected' 
  | 'system' 
  | 'competitor_update' 
  | 'client_update';

export interface NotificationData {
  suggestion_id?: string;
  approved_by?: string;
  rejected_by?: string;
  batch_id?: string;
  batch_name?: string;
  approved_count?: number;
  rejected_count?: number;
  url?: string;
  is_test?: boolean;
  tag?: string;
  [key: string]: any; // Para dados adicionais
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  suggestion_id?: string | null;
  data?: NotificationData | null;
  expires_at?: string | null;
}

