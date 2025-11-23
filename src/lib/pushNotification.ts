// Função para enviar notificação push via Firebase
import { supabase } from '@/integrations/supabase/client';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
}

/**
 * Envia notificação push para um usuário específico
 * Busca os tokens FCM do usuário e envia via Edge Function ou API
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    console.log('🔔 Iniciando envio de push notification para usuário:', userId);
    console.log('🌐 Ambiente:', window.location.hostname + ':' + window.location.port);
    
    // Buscar tokens FCM do usuário
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions' as any)
      .select('fcm_token')
      .eq('user_id', userId);

    if (error) {
      // Se a tabela não existe, apenas logar e retornar
      if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
        console.warn('⚠️ Tabela push_subscriptions não existe. Execute a migration SQL.');
        return false;
      }
      console.error('❌ Erro ao buscar tokens FCM:', error);
      return false;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.warn('⚠️ Usuário não tem tokens FCM registrados');
      console.log('💡 Ative as notificações push em /settings primeiro');
      return false;
    }

    console.log(`📱 Encontrados ${subscriptions.length} token(s) FCM para o usuário`);

    // Enviar push para cada token
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        console.log('📤 Enviando push para token:', sub.fcm_token.substring(0, 30) + '...');
        return await sendPushToToken(sub.fcm_token, payload);
      })
    );

    // Analisar resultados
    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true);
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false));
    
    console.log(`📊 Resultado: ${successful.length} sucesso, ${failed.length} falhas de ${subscriptions.length} total`);

    if (failed.length > 0) {
      failed.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Falha ${index + 1}:`, result.reason);
        } else {
          console.warn(`⚠️ Falha ${index + 1}: Push não foi enviado`);
        }
      });
    }

    return successful.length > 0;
  } catch (error) {
    console.error('❌ Erro ao enviar push notification:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    return false;
  }
}

/**
 * Envia notificação push para um token FCM específico
 * Usa uma Edge Function do Supabase ou API externa
 */
async function sendPushToToken(
  fcmToken: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    console.log('📤 Tentando enviar push via Edge Function...');
    console.log('Token FCM:', fcmToken.substring(0, 20) + '...');
    console.log('Payload:', payload);

    // Opção 1: Usar Edge Function do Supabase (recomendado)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ijygsxwfmribbjymxhaf.supabase.co';
    console.log('🔗 Tentando chamar Edge Function:', `${supabaseUrl}/functions/v1/send-push-notification`);
    
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/favicon.ico',
          badge: payload.badge || '/favicon.ico',
        },
        data: {
          ...payload.data,
          url: payload.url || '/dashboard',
          tag: payload.tag || 'notification',
        }
      },
      // Adicionar headers explícitos para garantir autenticação
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (error) {
      console.error('❌ Erro ao chamar Edge Function:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        context: error.context,
        status: error.status
      });

      // Se for 404, pode ser problema de autenticação ou função não encontrada
      if (error.status === 404 || error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('Function not found')) {
        console.error('');
        console.error('🔴 ERRO 404 - Edge Function existe mas retorna 404');
        console.error('');
        console.error('💡 Possíveis causas:');
        console.error('   1. Problema de autenticação (anon key pode estar incorreta)');
        console.error('   2. Edge Function precisa ser redeployada');
        console.error('   3. Verifique os logs da função no Dashboard');
        console.error('');
        console.error('🔍 Verificações:');
        console.error('   - Acesse: https://supabase.com/dashboard');
        console.error('   - Vá em Edge Functions > send-push-notification > Logs');
        console.error('   - Veja se há erros nos logs');
        console.error('   - Tente fazer um novo deploy da função');
        console.error('   - Verifique se a função está ativa');
        console.error('');
        return false;
      }
      
      // Se for erro de autenticação
      if (error.status === 401 || error.message?.includes('unauthorized')) {
        console.error('❌ Erro de autenticação. Verifique o Access Token no Supabase Dashboard.');
        return false;
      }

      // Não lançar erro, apenas retornar false para não quebrar o fluxo
      console.error('⚠️ Erro desconhecido ao chamar Edge Function, continuando sem push...');
      return false;
    }

    console.log('✅ Resposta da Edge Function:', data);
    
    if (data?.success) {
      console.log('✅ Push enviado com sucesso via Edge Function');
      return true;
    } else {
      console.warn('⚠️ Edge Function retornou sucesso=false:', data);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Erro ao enviar push via Edge Function:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

/**
 * Método alternativo: Enviar push via API HTTP direta do Firebase
 * IMPORTANTE: A API Key do cliente NÃO funciona para enviar push!
 * Você precisa usar Server Key ou Firebase Admin SDK
 */
async function sendPushViaAPI(
  fcmToken: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    console.warn('⚠️ Tentando enviar push via API REST...');
    console.warn('⚠️ NOTA: A API Key do cliente não tem permissão para enviar push!');
    console.warn('⚠️ Para enviar push, você precisa:');
    console.warn('   1. Configurar Edge Function do Supabase com Firebase Admin SDK');
    console.warn('   2. OU usar Firebase Console para enviar notificações');
    console.warn('   3. OU criar um backend com Firebase Admin SDK');
    
    // A API Key do cliente não funciona para enviar push
    // Retornar false e mostrar mensagem clara
    console.error('❌ Não é possível enviar push usando API Key do cliente');
    console.error('💡 Use o Firebase Console para testar:');
    console.error('   https://console.firebase.google.com/project/notifica-6e935/notification');
    
    return false;
  } catch (error) {
    console.error('❌ Erro ao enviar push via API:', error);
    return false;
  }
}

/**
 * Envia notificação push para múltiplos usuários
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, payload))
  );

  const success = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - success;

  return { success, failed };
}

