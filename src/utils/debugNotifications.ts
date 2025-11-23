// Script de diagnóstico para notificações
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export async function debugNotifications() {
  const { user } = useAuth();
  
  if (!user) {
    console.error('❌ Usuário não autenticado');
    return;
  }

  console.log('🔍 DIAGNÓSTICO DE NOTIFICAÇÕES');
  console.log('================================');
  console.log('User ID:', user.id);
  console.log('User Email:', user.email);
  
  // 1. Verificar se há notificações no banco para este usuário
  const { data: allNotifications, error: allError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n📬 Notificações no banco (últimas 10):');
  if (allError) {
    console.error('❌ Erro ao buscar notificações:', allError);
  } else {
    console.log('Total encontradas:', allNotifications?.length || 0);
    allNotifications?.forEach((n, i) => {
      console.log(`${i + 1}. ${n.title} - ${n.read ? 'Lida' : 'Não lida'} - ${n.created_at}`);
    });
  }
  
  // 2. Verificar estrutura da tabela
  console.log('\n📋 Estrutura da primeira notificação (se houver):');
  if (allNotifications && allNotifications.length > 0) {
    console.log('Campos:', Object.keys(allNotifications[0]));
    console.log('Dados completos:', allNotifications[0]);
  }
  
  // 3. Verificar RLS
  console.log('\n🔒 Verificando RLS:');
  const { data: rlsTest, error: rlsError } = await supabase
    .from('notifications')
    .select('count')
    .eq('user_id', user.id);
  
  if (rlsError) {
    console.error('❌ Erro de RLS:', rlsError);
  } else {
    console.log('✅ RLS permitindo acesso');
  }
  
  // 4. Verificar se há notificações recentes (últimas 5 minutos)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentNotifications, error: recentError } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });
  
  console.log('\n⏰ Notificações recentes (últimos 5 minutos):');
  if (recentError) {
    console.error('❌ Erro:', recentError);
  } else {
    console.log('Total:', recentNotifications?.length || 0);
    recentNotifications?.forEach((n, i) => {
      console.log(`${i + 1}. ${n.title} - ${n.created_at}`);
    });
  }
  
  return {
    allNotifications,
    recentNotifications,
    user
  };
}

