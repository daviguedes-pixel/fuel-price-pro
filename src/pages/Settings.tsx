import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Users, UsersRound, Database, TrendingUp, Bell, TestTube } from 'lucide-react';
import { PushNotificationSetup } from '@/components/PushNotificationSetup';
import { FirebaseDebug } from '@/components/FirebaseDebug';
import { FirebaseConfig } from '@/components/FirebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { createNotification } from '@/lib/utils';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  const handleTestApprovalNotification = async () => {
    if (!user) {
      toast.error('Você precisa estar autenticado para testar');
      return;
    }

    setIsTestingNotification(true);
    try {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🧪 TESTE DE NOTIFICAÇÃO DE APROVAÇÃO');
      console.log('═══════════════════════════════════════════════════════');
      console.log('User ID:', user.id);
      console.log('User Email:', user.email);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      // Buscar nome do usuário do perfil
      const { supabase } = await import('@/integrations/supabase/client');
      let approverName = user.email || 'Você';
      
      try {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('nome, email')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (userProfile?.nome) {
          approverName = userProfile.nome;
        } else if (userProfile?.email) {
          approverName = userProfile.email;
        }
      } catch (err) {
        console.warn('Erro ao buscar nome do usuário:', err);
      }

      // Criar notificação de teste de aprovação
      const notificationData = {
        suggestion_id: '00000000-0000-0000-0000-000000000000', // UUID de teste
        approved_by: approverName,
        url: '/approvals',
        is_test: true
      };

      console.log('📝 Criando notificação de teste...');
      const result = await createNotification(
        user.id,
        'price_approved',
        'Preço Aprovado (Teste)',
        `Sua solicitação de preço foi aprovada por ${approverName}! Esta é uma notificação de teste.`,
        notificationData
      );

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ NOTIFICAÇÃO DE TESTE CRIADA');
      console.log('═══════════════════════════════════════════════════════');
      console.log('Result:', result);
      console.log('Aprovador:', approverName);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('💡 Verifique:');
      console.log('   1. Centro de notificações (sino no topo)');
      console.log('   2. Push notification (se estiver ativada)');
      console.log('   3. Console para logs detalhados');
      console.log('');

      // Verificar status da push notification após criar a notificação
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 VERIFICANDO STATUS DA PUSH NOTIFICATION');
      console.log('═══════════════════════════════════════════════════════');
      
      // Reutilizar supabase já importado acima
      const { data: tokens, error: tokensError } = await supabase
        .from('push_subscriptions' as any)
        .select('fcm_token, id, created_at')
        .eq('user_id', user.id);

      console.log('Tokens encontrados:', tokens?.length || 0);
      console.log('Erro ao buscar tokens:', tokensError);
      
      if (tokensError) {
        console.error('❌ Erro ao buscar tokens FCM:', tokensError);
      } else if (!tokens || tokens.length === 0) {
        console.warn('⚠️ Nenhum token FCM encontrado no banco de dados');
        console.warn('💡 Ação: Ative as notificações push em /settings primeiro');
      } else {
        console.log('✅ Tokens FCM encontrados:', tokens.length);
        tokens.forEach((token: any, index: number) => {
          console.log(`   ${index + 1}. Token: ${token.fcm_token?.substring(0, 30)}...`);
        });
      }
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      const hasTokens = tokens && tokens.length > 0;

      if (hasTokens) {
        toast.success('Notificação de teste criada!', {
          description: `Notificação do site criada. Push notification tentou enviar para ${tokens.length} token(s). Verifique o console (F12) para detalhes.`,
          duration: 12000
        });
      } else {
        toast.warning('Notificação do site criada, mas push não enviou!', {
          description: 'Nenhum token FCM encontrado. Ative as notificações push primeiro em /settings',
          duration: 12000
        });
      }

      // Disparar evento para refresh das notificações
      window.dispatchEvent(new CustomEvent('notification-created', { 
        detail: { userId: user.id } 
      }));

      // Também disparar via localStorage como fallback
      localStorage.setItem('notification-refresh', Date.now().toString());
      setTimeout(() => {
        localStorage.removeItem('notification-refresh');
      }, 100);

    } catch (error: any) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ ERRO AO CRIAR NOTIFICAÇÃO DE TESTE');
      console.error('═══════════════════════════════════════════════════════');
      console.error('Erro:', error);
      console.error('Mensagem:', error?.message);
      console.error('Stack:', error?.stack);
      console.error('═══════════════════════════════════════════════════════');
      console.error('');
      
      toast.error('Erro ao criar notificação de teste', {
        description: error?.message || 'Verifique o console para mais detalhes',
        duration: 8000
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-card">
      <div className="container mx-auto px-4 py-3 space-y-3">
        {/* Header */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 text-white shadow-lg">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg font-bold mb-0.5">Configurações</h1>
                <p className="text-slate-200 text-xs">Configurações gerais do sistema</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/gestao')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <UsersRound className="h-6 w-6 text-blue-600" />
                <CardTitle>Gestão</CardTitle>
              </div>
              <CardDescription>Gerencie postos, clientes e tipos de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Administre postos, clientes e configurações de tipos de pagamento.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Gestão
              </Button>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/admin')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-6 w-6 text-blue-600" />
                <CardTitle>Usuários e Permissões</CardTitle>
              </div>
              <CardDescription>Gerencie usuários e suas permissões</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie usuários, papéis e permissões do sistema.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Usuários
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/tax-management')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-6 w-6 text-blue-600" />
                <CardTitle>Gestão de Taxas</CardTitle>
              </div>
              <CardDescription>Configure tipos de pagamento e taxas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie tipos de pagamento e taxas aplicadas.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Taxas
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/approval-margin-config')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                <CardTitle>Configurações de Aprovação por Margem</CardTitle>
              </div>
              <CardDescription>Configure regras de aprovação baseadas em margem</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Defina quais perfis devem aprovar baseado na margem de lucro.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Configurações
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/approval-order-config')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <UsersRound className="h-6 w-6 text-blue-600" />
                <CardTitle>Ordem de Aprovação</CardTitle>
              </div>
              <CardDescription>Defina a ordem hierárquica de aprovação dos perfis</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure em qual ordem os perfis devem aprovar as solicitações.
              </p>
              <Button variant="outline" className="w-full">
                Abrir Configurações
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Teste de Notificações */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <TestTube className="h-6 w-6 text-purple-600" />
              <CardTitle>Teste de Notificações</CardTitle>
            </div>
            <CardDescription>
              Teste se as notificações do site e push estão funcionando corretamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                Este botão cria uma notificação de aprovação de teste para verificar se:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside mb-4">
                <li>A notificação aparece no centro de notificações (sino no topo)</li>
                <li>A notificação push é enviada (se estiver ativada)</li>
                <li>O nome do aprovador é exibido corretamente</li>
              </ul>
            </div>
            <Button 
              onClick={handleTestApprovalNotification}
              disabled={isTestingNotification || !user}
              className="w-full"
              variant="default"
            >
              {isTestingNotification ? (
                <>
                  <Bell className="h-4 w-4 mr-2 animate-pulse" />
                  Criando notificação de teste...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Testar Notificação de Aprovação
                </>
              )}
            </Button>
            {!user && (
              <p className="text-xs text-muted-foreground text-center">
                Você precisa estar autenticado para testar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Configuração do Firebase */}
        <div className="mt-6 space-y-4">
          <FirebaseConfig />
        </div>

        {/* Notificações Push */}
        <div className="mt-6 space-y-4">
          <PushNotificationSetup />
          <FirebaseDebug />
        </div>
      </div>
    </div>
  );
}

