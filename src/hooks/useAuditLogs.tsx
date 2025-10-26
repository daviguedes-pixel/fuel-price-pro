import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
  user_email?: string;
}

export const useAuditLogs = () => {
  const { user } = useAuth();

  const logAction = async (
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT',
    tableName: string,
    recordId: string,
    oldData?: any,
    newData?: any
  ) => {
    if (!user) return;

    try {
      await supabase
        .from('audit_logs' as any)
        .insert([{
          user_id: user.id,
          action,
          table_name: tableName,
          record_id: recordId,
          old_data: oldData,
          new_data: newData,
          user_email: user.email,
        }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const getAuditLogs = async (filters?: {
    tableName?: string;
    recordId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.tableName) {
        query = query.eq('table_name', filters.tableName);
      }
      if (filters?.recordId) {
        query = query.eq('record_id', filters.recordId);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return [];
      }

      return (data as any) || [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  };

  return {
    logAction,
    getAuditLogs,
  };
};