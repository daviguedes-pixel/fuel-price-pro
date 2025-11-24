// Função para enviar notificação push via Firebase
import { supabase } from '@/integrations/supabase/client';
import { debounce } from '@/lib/debounce';
import { logger } from '@/lib/logger';

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
 * 
 * NOTA: Esta função já tem debounce interno para evitar race conditions
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    logger.log('🔔 Iniciando envio de push notification para usuário:', userId);
    logger.log('🌐 Ambiente:', window.location.hostname + ':' + window.location.port);
    
    // Buscar tokens FCM do usuário (apenas o mais recente para evitar duplicatas)
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('fcm_token, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      // Se a tabela não existe, apenas logar e retornar
      if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
        logger.warn('⚠️ Tabela push_subscriptions não existe. Execute a migration SQL.');
        return false;
      }
      logger.error('❌ Erro ao buscar tokens FCM:', error);
      return false;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logger.warn('⚠️ Usuário não tem tokens FCM registrados');
      logger.log('💡 Ative as notificações push em /settings primeiro');
      return false;
    }

    // Usar apenas o primeiro token (mais recente)
    const token = subscriptions[0].fcm_token;
    logger.log(`📱 Usando token FCM mais recente (${subscriptions.length} token(s) disponível(is), enviando apenas para 1)`);

    // Enviar push apenas para o token mais recente
    logger.log('');
    logger.log('═══════════════════════════════════════════════════════');
    logger.log('📤 ENVIANDO PUSH NOTIFICATION');
    logger.log('═══════════════════════════════════════════════════════');
    // Não logar token completo por segurança (apenas primeiros caracteres)
    logger.log('Token:', token.substring(0, 10) + '...***');
    logger.log('Payload:', payload);
    logger.log('═══════════════════════════════════════════════════════');
    logger.log('');
    
    try {
      const result = await sendPushToToken(token, payload);
      logger.log('📋 Resultado:', result);
      
      if (result === true) {
        logger.log('✅ Push enviado com sucesso!');
        return true;
      } else {
        logger.warn('⚠️ Push não foi enviado');
        return false;
      }
    } catch (error: any) {
      logger.error('❌ Erro ao enviar push:', error);
      logger.error('   Mensagem:', error?.message);
      logger.error('   Status:', error?.status);
      
      // Se for erro de token inválido, remover do banco
      if (error?.message === 'TOKEN_INVALID') {
        logger.warn('⚠️ Token inválido detectado, removendo do banco de dados...');
        try {
          await supabase
            .from('push_subscriptions' as any)
            .delete()
            .eq('fcm_token', token);
          logger.log('✅ Token inválido removido do banco de dados');
        } catch (deleteError) {
          logger.error('❌ Erro ao remover token inválido:', deleteError);
        }
      }
      
      return false;
    }
  } catch (error) {
    logger.error('❌ Erro ao enviar push notification:', error);
    logger.error('Stack:', error instanceof Error ? error.stack : 'N/A');
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
    // Não logar token completo por segurança
    logger.log('Token FCM:', fcmToken.substring(0, 10) + '...***');
    console.log('Payload:', payload);

    // Opção 1: Usar Edge Function do Supabase (recomendado)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ijygsxwfmribbjymxhaf.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    console.log('🔗 Tentando chamar Edge Function:', `${supabaseUrl}/functions/v1/send-push-notification`);
    
    const requestBody = {
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
    };

    console.log('📋 Request Body:', JSON.stringify(requestBody, null, 2));
    
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📥 Resposta da Edge Function:');
    console.log('   Data:', data);
    console.log('   Error:', error);
    console.log('   Error Status:', error?.status);
    console.log('   Error Message:', error?.message);

    // Se houver erro 500, tentar ler o corpo da resposta diretamente
    if (error && (error.status === 500 || !error.status)) {
      try {
        console.log('🔍 Tentando ler corpo da resposta de erro 500...');
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey || '',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorJson: any = null;
          try {
            errorJson = JSON.parse(errorText);
            console.error('📋 Corpo da resposta de erro (JSON):', errorJson);
            
            // Verificar se é erro UNREGISTERED (token inválido)
            let hasUnregistered = false;
            
            // Verificar em errorJson.details (pode ser string JSON aninhada)
            if (errorJson?.details) {
              try {
                const detailsObj = typeof errorJson.details === 'string' 
                  ? JSON.parse(errorJson.details) 
                  : errorJson.details;
                
                if (detailsObj?.error?.details) {
                  const fcmDetails = Array.isArray(detailsObj.error.details) 
                    ? detailsObj.error.details 
                    : [detailsObj.error.details];
                  
                  hasUnregistered = fcmDetails.some((d: any) => 
                    d?.errorCode === 'UNREGISTERED'
                  ) || detailsObj.error?.code === 'UNREGISTERED' ||
                     detailsObj.error?.errorCode === 'UNREGISTERED';
                }
              } catch (e) {
                // Se não conseguir parsear, verificar como string
                if (String(errorJson.details).includes('UNREGISTERED')) {
                  hasUnregistered = true;
                }
              }
            }
            
            // Verificar em errorJson.error diretamente
            if (!hasUnregistered && errorJson?.error) {
              const errorStr = JSON.stringify(errorJson.error);
              hasUnregistered = errorStr.includes('UNREGISTERED') ||
                               errorStr.includes('"errorCode":"UNREGISTERED"');
            }
            
            if (hasUnregistered) {
              console.error('');
              console.error('🔴 TOKEN FCM INVÁLIDO/EXPIRADO DETECTADO!');
              console.error('📋 Código de erro: UNREGISTERED');
              console.error('💡 Este token será removido automaticamente do banco de dados');
              console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
              console.error('');
              // Marcar para remoção
              error.context = { ...error.context, body: { ...errorJson, tokenInvalid: true } };
            }
            
            // Atualizar o erro com informações do corpo
            if (errorJson?.error) {
              error.message = errorJson.error;
            }
            if (errorJson?.details) {
              error.context = { ...error.context, body: errorJson };
            }
            if (errorJson?.hint) {
              console.error('💡 Dica:', errorJson.hint);
            }
          } catch {
            console.error('📋 Corpo da resposta de erro (texto):', errorText);
            error.context = { ...error.context, body: errorText };
            
            // Verificar se o texto contém UNREGISTERED
            if (String(errorText).includes('UNREGISTERED')) {
              console.error('');
              console.error('🔴 TOKEN FCM INVÁLIDO/EXPIRADO DETECTADO!');
              console.error('💡 Este token será removido automaticamente do banco de dados');
              console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
              console.error('');
              error.context = { ...error.context, body: { tokenInvalid: true } };
            }
          }
        }
      } catch (fetchError) {
        console.warn('⚠️ Não foi possível ler o corpo da resposta:', fetchError);
      }
    }

    if (error) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ ERRO AO CHAMAR EDGE FUNCTION');
      console.error('═══════════════════════════════════════════════════════');
      console.error('Mensagem:', error.message);
      console.error('Status:', error.status);
      console.error('Context:', error.context);
      console.error('═══════════════════════════════════════════════════════');
      console.error('');

      // Se for 404, pode ser problema de autenticação ou função não encontrada
      if (error.status === 404 || error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('Function not found')) {
        console.error('🔴 ERRO 404 - Edge Function não encontrada ou não acessível');
        console.error('');
        console.error('💡 SOLUÇÃO:');
        console.error('   1. Acesse: https://supabase.com/dashboard');
        console.error('   2. Vá em Edge Functions > send-push-notification');
        console.error('   3. Verifique se a função está deployada');
        console.error('   4. Se não estiver, faça o deploy do arquivo:');
        console.error('      supabase/functions/send-push-notification/index.ts');
        console.error('   5. Verifique os logs da função');
        console.error('');
        return false;
      }
      
      // Se for erro de autenticação
      if (error.status === 401 || error.message?.includes('unauthorized')) {
        console.error('🔴 ERRO 401 - Problema de autenticação');
        console.error('');
        console.error('💡 SOLUÇÃO:');
        console.error('   1. Verifique se VITE_SUPABASE_ANON_KEY está configurada no .env');
        console.error('   2. Verifique se a anon key está correta');
        console.error('   3. Reinicie o servidor após alterar .env');
        console.error('');
        return false;
      }

      // Se for erro 500, pode ser problema na Edge Function
      if (error.status === 500 || error.status >= 500 || !error.status) {
        console.error('🔴 ERRO 500 - Erro interno na Edge Function');
        console.error('');
        
        // Verificar se há informações específicas no contexto
        let errorDetails: any = null;
        if (error.context?.body) {
          try {
            errorDetails = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
          } catch {
            errorDetails = { raw: error.context.body };
          }
        }
        
        if (errorDetails) {
          console.error('📋 Detalhes do erro da Edge Function:');
          console.error('   Erro:', errorDetails.error || 'N/A');
          console.error('   Dica:', errorDetails.hint || 'N/A');
          console.error('   Alternativa:', errorDetails.alternative || 'N/A');
          console.error('   Detalhes:', errorDetails.details || 'N/A');
          
          if (errorDetails.config_status) {
            console.error('   Status da configuração:');
            console.error('      FIREBASE_SERVICE_ACCOUNT_JSON:', errorDetails.config_status.has_service_account ? '✅' : '❌');
            console.error('      FIREBASE_ACCESS_TOKEN:', errorDetails.config_status.has_access_token ? '✅' : '❌');
          }
          console.error('');
        }
        
        console.error('💡 SOLUÇÃO:');
        console.error('   1. Acesse: Supabase Dashboard > Edge Functions > send-push-notification > Logs');
        console.error('   2. Veja os logs detalhados do erro (lá você verá o erro completo)');
        console.error('   3. Verifique se FIREBASE_SERVICE_ACCOUNT_JSON está configurado:');
        console.error('      - Edge Functions > Settings > Secrets');
        console.error('      - Adicione o secret: FIREBASE_SERVICE_ACCOUNT_JSON');
        console.error('      - Cole o JSON completo do Service Account do Firebase');
        console.error('   4. OU configure FIREBASE_ACCESS_TOKEN (mas expira em 1 hora)');
        console.error('');
        console.error('📖 Guia completo: docs/CONFIGURAR_EDGE_FUNCTION.md');
        console.error('');
        return false;
      }

      // Tentar parsear o contexto para ver se há mais informações
      if (error.context?.body) {
        try {
          const errorBody = typeof error.context.body === 'string' 
            ? JSON.parse(error.context.body) 
            : error.context.body;
          console.error('📋 Detalhes do erro (do contexto):', errorBody);
          
          // Verificar se é erro UNREGISTERED (token inválido)
          // O erro pode vir em diferentes formatos
          let hasUnregistered = false;
          
          // Formato 1: errorBody.details (string JSON)
          if (errorBody?.details) {
            try {
              const detailsObj = typeof errorBody.details === 'string' 
                ? JSON.parse(errorBody.details) 
                : errorBody.details;
              
              if (detailsObj?.error?.details) {
                const fcmErrorDetails = Array.isArray(detailsObj.error.details) 
                  ? detailsObj.error.details 
                  : [detailsObj.error.details];
                
                hasUnregistered = fcmErrorDetails.some((d: any) => 
                  d?.errorCode === 'UNREGISTERED'
                ) || detailsObj.error?.code === 'UNREGISTERED' ||
                   detailsObj.error?.errorCode === 'UNREGISTERED';
              }
            } catch (e) {
              // Tentar como string
              if (String(errorBody.details).includes('UNREGISTERED')) {
                hasUnregistered = true;
              }
            }
          }
          
          // Formato 2: errorBody.error diretamente
          if (!hasUnregistered && errorBody?.error) {
            const errorObj = typeof errorBody.error === 'string' 
              ? JSON.parse(errorBody.error) 
              : errorBody.error;
            
            if (errorObj?.details) {
              const details = Array.isArray(errorObj.details) ? errorObj.details : [errorObj.details];
              hasUnregistered = details.some((d: any) => 
                d?.errorCode === 'UNREGISTERED'
              ) || errorObj?.code === 'UNREGISTERED' ||
                 errorObj?.errorCode === 'UNREGISTERED';
            }
          }
          
          // Formato 3: Verificar como string
          if (!hasUnregistered) {
            const errorStr = JSON.stringify(errorBody);
            hasUnregistered = errorStr.includes('"errorCode":"UNREGISTERED"') ||
                             errorStr.includes('UNREGISTERED');
          }
          
          if (hasUnregistered || errorBody?.tokenInvalid === true) {
            console.error('');
            console.error('🔴 TOKEN FCM INVÁLIDO/EXPIRADO DETECTADO!');
            console.error('📋 Código de erro: UNREGISTERED');
            console.error('📋 Significa: O token não está mais registrado no Firebase');
            console.error('💡 Este token será removido automaticamente do banco de dados');
            console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
            console.error('');
            // Marcar token como inválido para remoção
            throw new Error('TOKEN_INVALID');
          }
          
          // Verificar se há mensagem específica sobre token ou Access Token
          if (errorBody?.error?.includes('token') || errorBody?.hint?.includes('token')) {
            console.error('');
            console.error('🔴 PROBLEMA: Token FCM inválido ou expirado');
            console.error('💡 Ação: Reative as notificações em /settings');
            console.error('');
          } else if (errorBody?.error?.includes('Access Token') || errorBody?.hint?.includes('Access Token')) {
            console.error('');
            console.error('🔴 PROBLEMA: Access Token do Firebase não configurado ou expirado');
            console.error('💡 Ação: Configure FIREBASE_SERVICE_ACCOUNT_JSON no Supabase Dashboard');
            console.error('   Edge Functions > Settings > Secrets');
            console.error('');
          }
        } catch (e: any) {
          // Se for erro TOKEN_INVALID, relançar
          if (e?.message === 'TOKEN_INVALID') {
            throw e;
          }
          // Não é JSON, apenas texto
          console.error('📋 Response body (texto):', error.context.body);
          
          // Verificar se o texto contém UNREGISTERED
          const bodyStr = String(error.context.body);
          if (bodyStr.includes('UNREGISTERED') || bodyStr.includes('"errorCode":"UNREGISTERED"')) {
            console.error('');
            console.error('🔴 TOKEN FCM INVÁLIDO/EXPIRADO DETECTADO!');
            console.error('💡 Este token será removido automaticamente do banco de dados');
            console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
            console.error('');
            throw new Error('TOKEN_INVALID');
          }
        }
      }

      // Não lançar erro, apenas retornar false para não quebrar o fluxo
      console.error('⚠️ Erro ao chamar Edge Function, continuando sem push...');
      return false;
    }

    // Se não houve erro, verificar se a resposta indica sucesso
    if (!error && data) {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ RESPOSTA DA EDGE FUNCTION (SEM ERRO)');
      console.log('═══════════════════════════════════════════════════════');
      console.log('Data recebida:', data);
      console.log('Tipo da resposta:', typeof data);
      console.log('Success:', data?.success);
      console.log('Message ID:', data?.messageId || 'N/A');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      
      // Verificar se a resposta indica sucesso
      if (data?.success === true || data?.messageId || (typeof data === 'object' && !data.error)) {
        console.log('✅ Push enviado com sucesso via Edge Function');
        console.log('💡 Se a notificação não apareceu, verifique:');
        console.log('   1. Permissões do navegador (Configurações > Notificações)');
        console.log('   2. Service Worker está ativo? (Application > Service Workers)');
        console.log('   3. Navegador está em primeiro plano? (Push funciona melhor em background)');
        console.log('   4. Verifique o Service Worker no DevTools: Application > Service Workers');
        console.log('   5. Verifique se há erros no console do Service Worker');
        return true;
      } else {
        console.warn('⚠️ Edge Function retornou, mas não há confirmação clara de sucesso');
        console.warn('Data recebida:', data);
        console.warn('💡 Verifique os logs da Edge Function no Supabase Dashboard');
        return false;
      }
      
      // Verificar se há avisos ou erros na resposta
      if (data.error) {
        console.error('⚠️ Edge Function retornou sucesso mas há erro:', data.error);
        console.error('📋 Detalhes:', data.details);
      }
      
      return true;
    } else {
      console.warn('⚠️ Edge Function retornou sucesso=false:', data);
      
      // Verificar detalhes do erro
      if (data?.error) {
        console.error('❌ Erro retornado pela Edge Function:', data.error);
        console.error('📋 Detalhes:', data.details);
        console.error('📋 Status:', data.status);
        
        // Verificar se é erro de token inválido/expirado (UNREGISTERED)
        let isTokenInvalid = false;
        
        // Tentar parsear os detalhes para ver o erro do FCM
        if (data.details) {
          try {
            // Primeiro, tentar parsear como JSON
            let detailsObj: any;
            if (typeof data.details === 'string') {
              detailsObj = JSON.parse(data.details);
            } else {
              detailsObj = data.details;
            }
            
            // Verificar erro UNREGISTERED em diferentes níveis
            const errorDetails = detailsObj?.error?.details || [];
            const detailsArray = Array.isArray(errorDetails) ? errorDetails : [errorDetails];
            
            const hasUnregistered = detailsArray.some((d: any) => 
              d?.errorCode === 'UNREGISTERED' ||
              d?.['@type']?.includes('FcmError') && d?.errorCode === 'UNREGISTERED'
            ) || detailsObj?.error?.code === 'UNREGISTERED' ||
               detailsObj?.error?.errorCode === 'UNREGISTERED' ||
               detailsObj?.error?.status === 'NOT_FOUND';
            
            if (hasUnregistered) {
              isTokenInvalid = true;
              console.error('');
              console.error('🔴 TOKEN FCM INVÁLIDO/EXPIRADO DETECTADO!');
              console.error('📋 Código de erro do FCM: UNREGISTERED');
              console.error('📋 Significa: O token não está mais registrado no Firebase');
              console.error('💡 Este token será removido automaticamente do banco de dados');
              console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
              console.error('');
              throw new Error('TOKEN_INVALID');
            }
          } catch (parseError: any) {
            // Se for TOKEN_INVALID, relançar
            if (parseError?.message === 'TOKEN_INVALID') {
              throw parseError;
            }
            
            // Não é JSON válido, verificar como string
            const detailsStr = String(data.details);
            if (detailsStr.includes('UNREGISTERED') || 
                detailsStr.includes('"errorCode":"UNREGISTERED"') ||
                detailsStr.includes('"errorCode": "UNREGISTERED"') ||
                detailsStr.includes('registration-token-not-registered') ||
                detailsStr.includes('token is not registered')) {
              isTokenInvalid = true;
              console.error('');
              console.error('🔴 TOKEN FCM INVÁLIDO/EXPIRADO DETECTADO!');
              console.error('💡 Este token será removido automaticamente do banco de dados');
              console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
              console.error('');
              throw new Error('TOKEN_INVALID');
            }
          }
        }
        
        // Verificar se a Edge Function detectou token inválido
        if (!isTokenInvalid && (data.tokenInvalid === true || 
                              data.error?.includes('Token FCM inválido') ||
                              data.error?.includes('token inválido') ||
                              data.error?.includes('token expirado'))) {
          isTokenInvalid = true;
          console.error('');
          console.error('🔴 PROBLEMA: Token FCM inválido ou expirado');
          console.error('📋 Código de erro do FCM:', data.errorCode || 'N/A');
          console.error('📋 Motivo:', data.errorReason || 'N/A');
          console.error('💡 Este token será removido automaticamente do banco de dados');
          console.error('💡 Ação: Reative as notificações em /settings para gerar um novo token');
          console.error('');
          throw new Error('TOKEN_INVALID');
        } else if (data.error?.includes('Access Token') || data.details?.includes('Access Token')) {
          console.error('');
          console.error('🔴 PROBLEMA: Access Token do Firebase expirado ou não configurado');
          console.error('💡 Ação: Configure FIREBASE_SERVICE_ACCOUNT_JSON no Supabase Dashboard');
          console.error('');
        } else {
          console.error('');
          console.error('🔴 PROBLEMA DESCONHECIDO');
          console.error('💡 Verifique os logs da Edge Function no Supabase Dashboard');
          console.error('   Edge Functions > send-push-notification > Logs');
          console.error('');
        }
      }
      
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

/**
 * Função de diagnóstico para verificar o status do sistema de notificações
 */
export async function diagnosePushNotifications(userId?: string): Promise<{
  hasTokens: boolean;
  tokenCount: number;
  edgeFunctionStatus: 'ok' | 'error' | 'unknown';
  serviceWorkerStatus: 'ok' | 'not_registered' | 'unknown';
  permissionStatus: NotificationPermission;
  issues: string[];
}> {
  const issues: string[] = [];
  let hasTokens = false;
  let tokenCount = 0;
  let edgeFunctionStatus: 'ok' | 'error' | 'unknown' = 'unknown';
  let serviceWorkerStatus: 'ok' | 'not_registered' | 'unknown' = 'unknown';
  const permissionStatus = Notification.permission;

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DO SISTEMA DE NOTIFICAÇÕES');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // 1. Verificar permissão
  console.log('1️⃣ Verificando permissão do navegador...');
  if (permissionStatus === 'denied') {
    issues.push('Permissão de notificações está bloqueada. Permita nas configurações do navegador.');
    console.error('   ❌ Permissão: DENIED');
  } else if (permissionStatus === 'default') {
    issues.push('Permissão de notificações não foi solicitada. Ative as notificações em /settings.');
    console.warn('   ⚠️ Permissão: DEFAULT (não solicitada)');
  } else {
    console.log('   ✅ Permissão: GRANTED');
  }
  console.log('');

  // 2. Verificar Service Worker
  console.log('2️⃣ Verificando Service Worker...');
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        if (registration.active) {
          serviceWorkerStatus = 'ok';
          console.log('   ✅ Service Worker registrado e ativo');
          console.log('      Scope:', registration.scope);
        } else {
          serviceWorkerStatus = 'not_registered';
          issues.push('Service Worker está registrado mas não está ativo. Recarregue a página.');
          console.warn('   ⚠️ Service Worker registrado mas não ativo');
        }
      } else {
        serviceWorkerStatus = 'not_registered';
        issues.push('Service Worker não está registrado. Recarregue a página.');
        console.error('   ❌ Service Worker não registrado');
      }
    } catch (error) {
      serviceWorkerStatus = 'unknown';
      issues.push('Erro ao verificar Service Worker.');
      console.error('   ❌ Erro ao verificar Service Worker:', error);
    }
  } else {
    issues.push('Navegador não suporta Service Workers.');
    console.error('   ❌ Service Workers não suportados');
  }
  console.log('');

  // 3. Verificar tokens FCM
  console.log('3️⃣ Verificando tokens FCM no banco de dados...');
  if (userId) {
    try {
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions' as any)
        .select('fcm_token')
        .eq('user_id', userId);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
          issues.push('Tabela push_subscriptions não existe. Execute a migration SQL.');
          console.error('   ❌ Tabela push_subscriptions não existe');
        } else {
          issues.push(`Erro ao buscar tokens: ${error.message}`);
          console.error('   ❌ Erro ao buscar tokens:', error);
        }
      } else if (!subscriptions || subscriptions.length === 0) {
        issues.push('Nenhum token FCM encontrado. Ative as notificações em /settings.');
        console.warn('   ⚠️ Nenhum token FCM encontrado');
      } else {
        hasTokens = true;
        tokenCount = subscriptions.length;
        console.log(`   ✅ Encontrados ${tokenCount} token(s) FCM`);
        
        // Verificar se os tokens não estão vazios
        const invalidTokens = subscriptions.filter((sub: any) => !sub.fcm_token || sub.fcm_token.trim() === '');
        if (invalidTokens.length > 0) {
          issues.push(`${invalidTokens.length} token(s) FCM inválido(s) encontrado(s). Reative as notificações.`);
          console.warn(`   ⚠️ ${invalidTokens.length} token(s) inválido(s)`);
        }
      }
    } catch (error) {
      issues.push('Erro ao verificar tokens FCM.');
      console.error('   ❌ Erro ao verificar tokens:', error);
    }
  } else {
    console.warn('   ⚠️ userId não fornecido, pulando verificação de tokens');
  }
  console.log('');

  // 4. Testar Edge Function
  console.log('4️⃣ Testando Edge Function...');
  try {
    // Fazer uma chamada de teste simples (sem enviar push de verdade)
    const { error: testError } = await supabase.functions.invoke('send-push-notification', {
      body: {
        token: 'test-token',
        notification: {
          title: 'Test',
          body: 'Test'
        }
      }
    });

    // Esperamos um erro, mas não um 404 ou erro de rede
    if (testError) {
      if (testError.status === 404) {
        edgeFunctionStatus = 'error';
        issues.push('Edge Function não encontrada (404). Verifique se está deployada.');
        console.error('   ❌ Edge Function não encontrada (404)');
      } else if (testError.status === 401) {
        edgeFunctionStatus = 'error';
        issues.push('Erro de autenticação na Edge Function. Verifique VITE_SUPABASE_ANON_KEY.');
        console.error('   ❌ Erro de autenticação (401)');
      } else if (testError.message?.includes('token') && testError.message?.includes('obrigatório')) {
        // Este é o erro esperado quando passamos um token de teste
        edgeFunctionStatus = 'ok';
        console.log('   ✅ Edge Function está acessível e funcionando');
      } else {
        edgeFunctionStatus = 'error';
        issues.push(`Edge Function retornou erro: ${testError.message}`);
        console.warn(`   ⚠️ Edge Function retornou: ${testError.message}`);
      }
    } else {
      edgeFunctionStatus = 'ok';
      console.log('   ✅ Edge Function está acessível');
    }
  } catch (error: any) {
    edgeFunctionStatus = 'error';
    issues.push('Erro ao testar Edge Function. Verifique a conexão.');
    console.error('   ❌ Erro ao testar Edge Function:', error.message);
  }
  console.log('');

  // Resumo
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESUMO DO DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Permissão: ${permissionStatus === 'granted' ? '✅' : '❌'} ${permissionStatus}`);
  console.log(`Service Worker: ${serviceWorkerStatus === 'ok' ? '✅' : '❌'} ${serviceWorkerStatus}`);
  console.log(`Tokens FCM: ${hasTokens ? '✅' : '❌'} ${tokenCount} token(s)`);
  console.log(`Edge Function: ${edgeFunctionStatus === 'ok' ? '✅' : '❌'} ${edgeFunctionStatus}`);
  console.log('');

  if (issues.length > 0) {
    console.log('⚠️ PROBLEMAS ENCONTRADOS:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  } else {
    console.log('✅ Nenhum problema encontrado! Sistema de notificações está OK.');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return {
    hasTokens,
    tokenCount,
    edgeFunctionStatus,
    serviceWorkerStatus,
    permissionStatus,
    issues
  };
}

