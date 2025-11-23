import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebasePush } from '@/hooks/useFirebasePush';
import { useAuth } from '@/hooks/useAuth';
import { sendPushNotification } from '@/lib/pushNotification';
import { Bell, BellOff, CheckCircle, XCircle, AlertCircle, Send, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function PushNotificationSetup() {
  const { isSupported, permission, fcmToken, isLoading, requestToken, removeToken } = useFirebasePush();
  const { user } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isTestingEdgeFunction, setIsTestingEdgeFunction] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const token = await requestToken();
      if (token) {
        toast.success('Notificações push ativadas!');
      } else {
        toast.error('Não foi possível ativar notificações. Verifique as configurações do Firebase.');
      }
    } catch (error) {
      toast.error('Erro ao ativar notificações');
      console.error(error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDisable = async () => {
    try {
      await removeToken();
      toast.success('Notificações push desativadas');
    } catch (error) {
      toast.error('Erro ao desativar notificações');
      console.error(error);
    }
  };

  const handleSendTest = async () => {
    if (!user) {
      toast.error('Você precisa estar autenticado');
      return;
    }

    if (!fcmToken) {
      toast.error('Ative as notificações push primeiro');
      return;
    }

    setIsSendingTest(true);
    try {
      const success = await sendPushNotification(user.id, {
        title: '🧪 Notificação de Teste',
        body: 'Se você está vendo isso, as notificações push estão funcionando!',
        url: '/dashboard',
        tag: 'test'
      });

      if (success) {
        toast.success('Notificação de teste enviada! Verifique se apareceu.', {
          description: 'Se não aparecer, verifique o Console (F12) e os logs da Edge Function',
          duration: 10000
        });
        console.log('✅ sendPushNotification retornou true');
        console.log('💡 Se a notificação não apareceu, verifique:');
        console.log('   1. Permissões do navegador (Configurações > Notificações)');
        console.log('   2. Logs da Edge Function (Supabase Dashboard > Edge Functions > Logs)');
        console.log('   3. Console do navegador para erros');
      } else {
        console.error('❌ sendPushNotification retornou false');
        toast.warning(
          'Não foi possível enviar a notificação',
          {
            description: 'Verifique o Console (F12) e os logs da Edge Function para mais detalhes',
            duration: 10000
          }
        );
        console.log('💡 Verifique:');
        console.log('   1. Edge Function está deployada? (Supabase Dashboard > Edge Functions)');
        console.log('   2. Service Account JSON configurado? (Edge Functions > Settings > Secrets)');
        console.log('   3. Token FCM está no banco? (Table Editor > push_subscriptions)');
        console.log('   4. Logs da Edge Function mostram erros?');
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      toast.error('Erro ao enviar notificação de teste');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleTestEdgeFunction = async () => {
    if (!user) {
      toast.error('Você precisa estar autenticado');
      return;
    }

    setIsTestingEdgeFunction(true);
    try {
      // Buscar token FCM do banco automaticamente
      console.log('🔍 Buscando token FCM do banco...');
      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions' as any)
        .select('fcm_token')
        .eq('user_id', user.id)
        .limit(1);

      if (fetchError) {
        console.error('❌ Erro ao buscar token:', fetchError);
        toast.error('Erro ao buscar token FCM do banco');
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        toast.error('Nenhum token FCM encontrado. Ative as notificações push primeiro.');
        return;
      }

      const token = subscriptions[0].fcm_token;
      
      // Validar token
      if (!token || token.trim() === '') {
        console.error('❌ Token FCM está vazio ou inválido!');
        toast.error('Token FCM inválido. Ative as notificações push novamente.');
        return;
      }
      
      console.log('✅ Token FCM encontrado:', token.substring(0, 30) + '...');
      console.log('📋 Token completo:', token);
      console.log('📏 Tamanho do token:', token.length);

      // Verificar Service Worker antes de enviar
      console.log('🔍 Verificando Service Worker...');
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        console.log('✅ Service Worker registrado:', registration.scope);
        console.log('   Active:', registration.active ? '✅' : '❌');
        console.log('   Waiting:', registration.waiting ? '⚠️' : '✅');
        if (registration.waiting) {
          console.warn('⚠️ Service Worker está "waiting" - clique em "skipWaiting" no DevTools');
        }
      } else {
        console.error('❌ Service Worker não está registrado!');
      }

      // Chamar Edge Function diretamente
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📤 CHAMANDO EDGE FUNCTION...');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📋 Payload que será enviado:', {
        token: token.substring(0, 30) + '...',
        tokenLength: token.length,
        notification: {
          title: '🧪 Teste Automático',
          body: 'Esta notificação foi enviada automaticamente via Edge Function!'
        }
      });
      
      const payload = {
        token: token.trim(), // Garantir que não há espaços
        notification: {
          title: '🧪 Teste Automático',
          body: 'Esta notificação foi enviada automaticamente via Edge Function!'
        },
        data: {
          url: '/dashboard',
          tag: 'test-auto'
        }
      };
      
      console.log('📤 Enviando payload para Edge Function:', {
        ...payload,
        token: payload.token.substring(0, 30) + '...' // Não logar token completo por segurança
      });
      
      const { data: result, error: edgeError } = await supabase.functions.invoke('send-push-notification', {
        body: payload
      });

      if (edgeError) {
        console.error('❌ Erro retornado pela Edge Function:', edgeError);
        console.error('   Status:', edgeError.status);
        console.error('   Message:', edgeError.message);
        console.error('   Context:', edgeError.context);
        
        // Se o erro contém detalhes do token, mostrar
        if (edgeError.context?.body) {
          try {
            const errorBody = typeof edgeError.context.body === 'string' 
              ? JSON.parse(edgeError.context.body) 
              : edgeError.context.body;
            console.error('   Detalhes do erro:', errorBody);
          } catch (e) {
            console.error('   Response body:', edgeError.context.body);
          }
        }
        console.error('');
        console.error('═══════════════════════════════════════════════════════');
        console.error('❌❌❌ ERRO AO CHAMAR EDGE FUNCTION ❌❌❌');
        console.error('═══════════════════════════════════════════════════════');
        console.error('Mensagem:', edgeError.message);
        console.error('Status:', edgeError.status);
        console.error('Context:', edgeError.context);
        console.error('Erro completo:', edgeError);
        console.error('');
        console.error('💡 IMPORTANTE: Os logs da Edge Function aparecem no Supabase Dashboard!');
        console.error('   Acesse: Edge Functions > send-push-notification > Logs');
        console.error('   Lá você verá os logs detalhados do que a função recebeu');
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
        
        // Se for 404, mostrar mensagem específica sobre deploy
        if (edgeError.status === 404 || edgeError.message?.includes('not found') || edgeError.message?.includes('404')) {
          console.error('🔴 PROBLEMA IDENTIFICADO: Edge Function não está deployada!');
          console.error('');
          console.error('📋 SOLUÇÃO RÁPIDA:');
          console.error('   1. Acesse: https://supabase.com/dashboard');
          console.error('   2. Vá em Edge Functions');
          console.error('   3. Crie/edite a função: send-push-notification');
          console.error('   4. Cole o código de: supabase/functions/send-push-notification/index.ts');
          console.error('   5. Configure os Secrets (FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_ACCESS_TOKEN)');
          console.error('   6. Clique em Deploy');
          console.error('');
          console.error('📖 Guia completo: docs/DEPLOY_EDGE_FUNCTION_RAPIDO.md');
          console.error('');
        }
        
        console.error('💡 Possíveis causas:');
        console.error('   1. Edge Function não deployada corretamente (404)');
        console.error('      → Acesse: Supabase Dashboard > Edge Functions > send-push-notification');
        console.error('      → Clique em "Deploy" para fazer um novo deploy');
        console.error('      → Teste diretamente no Dashboard usando "Invoke"');
        console.error('');
        console.error('   2. Access Token expirado (se usando FIREBASE_ACCESS_TOKEN)');
        console.error('      → O Access Token expira em 1 hora!');
        console.error('      → Gere um novo token e atualize no Dashboard');
        console.error('      → OU use FIREBASE_SERVICE_ACCOUNT_JSON (não expira)');
        console.error('');
        console.error('   3. Service Account JSON não configurado');
        console.error('      → Supabase Dashboard > Edge Functions > Settings > Secrets');
        console.error('      → Configure FIREBASE_SERVICE_ACCOUNT_JSON (recomendado)');
        console.error('      → OU configure FIREBASE_ACCESS_TOKEN (expira em 1 hora)');
        console.error('');
        console.error('   4. Verifique os logs da Edge Function');
        console.error('      → Edge Functions > send-push-notification > Logs');
        console.error('      → Veja se há erros específicos');
        console.error('');
        console.error('📚 Guia completo: docs/RESOLVER_404_EDGE_FUNCTION.md');
        console.error('');
        
        toast.error('Erro ao chamar Edge Function', {
          description: `Status: ${edgeError.status || 'N/A'} - ${edgeError.message || 'Erro desconhecido'}. Verifique o Console (F12) para detalhes.`,
          duration: 15000
        });
        return;
      }

      console.log('═══════════════════════════════════════════════════════');
      console.log('📋 RESPOSTA DA EDGE FUNCTION:');
      console.log('═══════════════════════════════════════════════════════');
      console.log('Resultado:', result);
      console.log('Erro:', edgeError);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      
      if (result?.success) {
        toast.success('Edge Function executada com sucesso!', {
          description: 'MINIMIZE A JANELA AGORA para ver a notificação!',
          duration: 15000
        });
        
        console.log('✅✅✅ EDGE FUNCTION RETORNOU SUCESSO! ✅✅✅');
        console.log('');
        console.log('⚠️⚠️⚠️ IMPORTANTE: ⚠️⚠️⚠️');
        console.log('   Notificações push SÓ aparecem quando a janela está em BACKGROUND!');
        console.log('');
        console.log('📋 AGORA:');
        console.log('   1. MINIMIZE A JANELA (ou mude para outra aba)');
        console.log('   2. Aguarde 2-3 segundos');
        console.log('   3. A notificação deve aparecer');
        console.log('');
        console.log('🔍 MONITORANDO NO CONSOLE:');
        console.log('   Se aparecer abaixo, o Service Worker recebeu:');
        console.log('   📬 ===== MENSAGEM RECEBIDA NO SERVICE WORKER =====');
        console.log('   ✅✅✅ NOTIFICAÇÃO EXIBIDA COM SUCESSO! ✅✅✅');
        console.log('');
        
        // Aguardar e verificar
        setTimeout(() => {
          console.log('');
          console.log('⏰ Verificação após 3 segundos:');
          console.log('   Se NÃO apareceu "MENSAGEM RECEBIDA NO SERVICE WORKER" acima,');
          console.log('   significa que o Service Worker não recebeu a mensagem do Firebase.');
          console.log('');
          console.log('💡 Possíveis causas:');
          console.log('   1. Service Worker não está ativo (verifique em Application > Service Workers)');
          console.log('   2. Firebase não foi inicializado no Service Worker');
          console.log('   3. Token FCM inválido ou expirado');
        }, 3000);
      } else {
        toast.warning('Edge Function retornou sem sucesso', {
          description: result?.error || 'Verifique os logs para mais detalhes',
          duration: 10000
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao testar Edge Function:', error);
      toast.error('Erro ao testar Edge Function', {
        description: error.message || 'Verifique o Console (F12)',
        duration: 10000
      });
    } finally {
      setIsTestingEdgeFunction(false);
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push ou o Firebase não está configurado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Para resolver:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Verifique se o arquivo <code className="bg-muted px-1 rounded">.env</code> existe na raiz do projeto</li>
              <li>Verifique se as variáveis <code className="bg-muted px-1 rounded">VITE_FIREBASE_*</code> estão configuradas</li>
              <li><strong>REINICIE o servidor</strong> após criar/editar o <code className="bg-muted px-1 rounded">.env</code></li>
              <li>Recarregue a página (Ctrl+Shift+R)</li>
            </ol>
            <p className="mt-2 text-xs">
              Abra o Console do navegador (F12) para ver mensagens de debug detalhadas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-900 dark:text-blue-900" />
          Notificações Push do Google
        </CardTitle>
        <CardDescription>
          Receba notificações mesmo quando o site estiver fechado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'granted' && fcmToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Notificações ativadas</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Você receberá notificações push quando houver novas atualizações.
            </p>
            
            {/* Mostrar Token FCM para debug */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Token FCM (para teste):</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">
                  {fcmToken}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(fcmToken);
                    toast.success('Token copiado!');
                  }}
                  className="shrink-0"
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use este token para testar a Edge Function no Supabase Dashboard
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSendingTest ? 'Enviando...' : 'Enviar Teste'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisable}
                  className="flex-1"
                >
                  <BellOff className="h-4 w-4 mr-2" />
                  Desativar
                </Button>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={handleTestEdgeFunction}
                  disabled={isTestingEdgeFunction}
                  variant="secondary"
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTestingEdgeFunction ? 'Testando Edge Function...' : 'Testar Edge Function (Automático)'}
                </Button>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                    ⚠️ IMPORTANTE: Como ver os logs do Service Worker
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                    <li>Abra DevTools (F12)</li>
                    <li>Vá em <strong>Application</strong> &gt; <strong>Service Workers</strong></li>
                    <li>Clique no Service Worker <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">firebase-messaging-sw.js</code></li>
                    <li>Procure por um botão <strong>"Console"</strong> ou <strong>"Inspect"</strong> ao lado do Service Worker</li>
                    <li>OU clique com botão direito no Service Worker e escolha <strong>"Inspect"</strong></li>
                  </ol>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    <strong>💡 Dica:</strong> Teste com a janela minimizada! Notificações push só aparecem quando a janela está em background.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : permission === 'denied' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Notificações bloqueadas</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Você bloqueou as notificações. Para ativar, acesse as configurações do navegador.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ative as notificações push para receber alertas importantes mesmo quando o site estiver fechado.
            </p>
            <Button
              onClick={handleEnable}
              disabled={isLoading || isRequesting}
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              {isLoading || isRequesting ? 'Ativando...' : 'Ativar Notificações Push'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

