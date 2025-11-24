import { useState, useEffect, useRef } from 'react';
import { requestNotificationPermission, onMessageListener, initFirebase, getCurrentToken } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PushSubscription {
  id?: string;
  user_id: string;
  fcm_token: string;
  device_info?: any;
  created_at?: string;
}

export const useFirebasePush = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const tokenCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownTokenRef = useRef<string | null>(null);

  // Verificar suporte e permissão
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === 'undefined') return;
      
      console.log('🔍 Verificando suporte para notificações push...');
      
      // Verificar se navegador suporta notificações
      if (!('Notification' in window)) {
        console.warn('❌ Este navegador não suporta notificações');
        return;
      }

      console.log('✅ Navegador suporta notificações');

      // Verificar se Firebase está configurado
      console.log('🔧 Inicializando Firebase...');
      const { messaging, app } = await initFirebase();
      
      console.log('📋 Resultado da inicialização:', {
        hasApp: !!app,
        hasMessaging: !!messaging,
        appInitialized: app ? '✅' : '❌',
        messagingInitialized: messaging ? '✅' : '❌'
      });
      
      if (!messaging) {
        console.error('❌ Firebase Messaging não está disponível');
        console.error('📋 Possíveis causas:');
        console.error('   1. Variáveis de ambiente não configuradas (.env)');
        console.error('   2. Servidor não foi reiniciado após criar .env');
        console.error('   3. Service Worker não está registrado');
        console.error('   4. Navegador não suporta Firebase Messaging');
        console.error('');
        console.error('💡 Verifique:');
        console.error('   - Arquivo .env existe na raiz do projeto?');
        console.error('   - Variáveis VITE_FIREBASE_* estão configuradas?');
        console.error('   - Servidor foi reiniciado após criar .env?');
        console.error('   - Está usando HTTPS ou localhost?');
        return;
      }

      console.log('✅ Firebase Messaging disponível');
      setIsSupported(true);
      setPermission(Notification.permission);
      console.log('📱 Permissão atual:', Notification.permission);

      // Se já tem permissão, obter token
      if (Notification.permission === 'granted' && user) {
        console.log('✅ Permissão já concedida, obtendo token...');
        requestToken();
      }
    };

    if (user) {
      checkSupport();
    }
  }, [user]);

  // Verificar e atualizar token automaticamente (a cada 5 minutos)
  useEffect(() => {
    if (!isSupported || !user || Notification.permission !== 'granted') {
      return;
    }

    console.log('🔄 Iniciando verificação automática de tokens...');
    console.log('   Intervalo: 5 minutos');
    console.log('   Objetivo: Manter tokens sempre atualizados');

    const checkAndUpdateToken = async () => {
      try {
        const currentToken = await getCurrentToken();
        
        if (!currentToken) {
          console.warn('⚠️ Não foi possível obter token atual');
          return;
        }

        // Se o token mudou, atualizar no banco
        if (currentToken !== lastKnownTokenRef.current) {
          console.log('');
          console.log('🔄 TOKEN FCM MUDOU! Atualizando automaticamente...');
          console.log('   Token antigo:', lastKnownTokenRef.current ? lastKnownTokenRef.current.substring(0, 30) + '...' : 'N/A');
          console.log('   Token novo:', currentToken.substring(0, 30) + '...');
          
          lastKnownTokenRef.current = currentToken;
          setFcmToken(currentToken);
          
          // Atualizar token no banco de dados
          await updateTokenInDatabase(currentToken);
        } else {
          console.log('✅ Token FCM ainda é o mesmo, sem necessidade de atualização');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar token:', error);
      }
    };

    // Verificar imediatamente
    checkAndUpdateToken();

    // Configurar verificação periódica (a cada 5 minutos)
    tokenCheckIntervalRef.current = setInterval(checkAndUpdateToken, 5 * 60 * 1000);

    return () => {
      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
        tokenCheckIntervalRef.current = null;
      }
    };
  }, [isSupported, user]);

  // Escutar mensagens quando app está em primeiro plano
  useEffect(() => {
    if (!isSupported || !user) return;

    onMessageListener().then((payload: any) => {
      console.log('📬 Mensagem recebida:', payload);
      
      // Mostrar toast
      toast.info(payload.notification?.title || 'Nova Notificação', {
        description: payload.notification?.body || payload.data?.message,
        duration: 5000,
        action: {
          label: 'Ver',
          onClick: () => {
            if (payload.data?.url) {
              window.location.href = payload.data.url;
            }
          }
        }
      });
    });
  }, [isSupported, user]);

  // Solicitar permissão e obter token
  const requestToken = async (): Promise<string | null> => {
    if (!user) {
      console.warn('Usuário não autenticado');
      return null;
    }

    setIsLoading(true);
    try {
      const token = await requestNotificationPermission();
      
      if (token) {
        setFcmToken(token);
        setPermission(Notification.permission);
        lastKnownTokenRef.current = token;
        
        // Salvar token no banco de dados
        await saveTokenToDatabase(token);
        
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter token FCM:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar token no banco de dados (substitui tokens antigos)
  const updateTokenInDatabase = async (newToken: string) => {
    if (!user) {
      console.warn('⚠️ Usuário não autenticado, não é possível atualizar token');
      return;
    }

    console.log('💾 Atualizando token FCM no banco de dados...');

    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        updatedAt: new Date().toISOString()
      };

      // Verificar se já existe este token exato
      const { data: existing, error: checkError } = await supabase
        .from('push_subscriptions' as any)
        .select('id, fcm_token')
        .eq('user_id', user.id)
        .eq('fcm_token', newToken)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST205') {
        console.warn('⚠️ Erro ao verificar token existente:', checkError);
      }

      if (!existing) {
        // Buscar todos os tokens antigos do usuário
        const { data: oldTokens, error: fetchError } = await supabase
          .from('push_subscriptions' as any)
          .select('id, fcm_token')
          .eq('user_id', user.id);

        if (fetchError && fetchError.code !== 'PGRST205') {
          console.warn('⚠️ Erro ao buscar tokens antigos:', fetchError);
        }

        // Se houver tokens antigos do mesmo dispositivo, remover antes de inserir o novo
        if (oldTokens && oldTokens.length > 0) {
          console.log(`🧹 Removendo ${oldTokens.length} token(s) antigo(s) do mesmo usuário...`);
          
          const oldTokenIds = oldTokens.map(t => t.id);
          const { error: deleteError } = await supabase
            .from('push_subscriptions' as any)
            .delete()
            .in('id', oldTokenIds);

          if (deleteError && deleteError.code !== 'PGRST205') {
            console.warn('⚠️ Erro ao remover tokens antigos:', deleteError);
          } else {
            console.log(`✅ ${oldTokens.length} token(s) antigo(s) removido(s)`);
          }
        }

        // Inserir novo token
        console.log('📝 Inserindo novo token no banco...');
        const { data, error } = await supabase
          .from('push_subscriptions' as any)
          .insert({
            user_id: user.id,
            fcm_token: newToken,
            device_info: deviceInfo
          })
          .select();

        if (error) {
          // Se a tabela não existe, apenas logar
          if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
            console.error('❌ Tabela push_subscriptions não existe!');
            console.error('Execute a migration SQL: supabase/migrations/20250122000000_create_push_subscriptions.sql');
            return;
          }
          throw error;
        }

        console.log('✅ Token FCM atualizado no banco de dados:', data);
        lastKnownTokenRef.current = newToken;
      } else {
        console.log('ℹ️ Token já existe no banco de dados, sem necessidade de atualização');
        lastKnownTokenRef.current = newToken;
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar token no banco:', error);
      console.error('Detalhes:', error);
    }
  };

  // Salvar token no banco de dados (mantém compatibilidade)
  const saveTokenToDatabase = async (token: string) => {
    await updateTokenInDatabase(token);
  };

  // Remover token (quando usuário desativa notificações)
  const removeToken = async () => {
    if (!user || !fcmToken) return;

    try {
      const { error } = await supabase
        .from('push_subscriptions' as any)
        .delete()
        .eq('user_id', user.id)
        .eq('fcm_token', fcmToken);

      if (error && error.code !== 'PGRST205') {
        throw error;
      }

      setFcmToken(null);
      console.log('✅ Token FCM removido');
    } catch (error) {
      console.error('Erro ao remover token:', error);
    }
  };

  return {
    isSupported,
    permission,
    fcmToken,
    isLoading,
    requestToken,
    removeToken
  };
};

