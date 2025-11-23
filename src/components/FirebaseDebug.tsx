import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function FirebaseDebug() {
  const [checks, setChecks] = useState({
    envVars: false,
    firebaseConfig: false,
    messaging: false,
    serviceWorker: false,
    notifications: false
  });

  useEffect(() => {
    const runChecks = async () => {
      const newChecks = {
        envVars: false,
        firebaseConfig: false,
        messaging: false,
        serviceWorker: false,
        notifications: false
      };

      // Check 1: Variáveis de ambiente
      const hasApiKey = !!import.meta.env.VITE_FIREBASE_API_KEY;
      const hasProjectId = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
      newChecks.envVars = hasApiKey && hasProjectId;

      // Check 2: Firebase Config
      if (newChecks.envVars) {
        try {
          const { initFirebase } = await import('@/lib/firebase');
          const { app, messaging } = await initFirebase();
          newChecks.firebaseConfig = !!app;
          newChecks.messaging = !!messaging;
          
          if (!newChecks.messaging) {
            console.warn('⚠️ Firebase Messaging não foi inicializado. Verifique o console para detalhes.');
          }
        } catch (error) {
          console.error('Erro ao inicializar Firebase:', error);
        }
      }

      // Check 3: Service Worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          newChecks.serviceWorker = !!registration;
        } catch (error) {
          console.error('Erro ao verificar Service Worker:', error);
        }
      }

      // Check 4: Notificações
      newChecks.notifications = 'Notification' in window;

      setChecks(newChecks);
    };

    runChecks();
  }, []);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-500" />
          Diagnóstico do Firebase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Variáveis de Ambiente (.env)</span>
          {checks.envVars ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              OK
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Faltando
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Firebase Config</span>
          {checks.firebaseConfig ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              OK
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Erro
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Firebase Messaging</span>
          {checks.messaging ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              OK
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Não disponível
            </Badge>
          )}
        </div>
        {!checks.messaging && (
          <div className="ml-4 text-xs text-muted-foreground">
            <p>• Verifique se está usando HTTPS ou localhost</p>
            <p>• Verifique o console do navegador (F12) para erros</p>
            <p>• Service Worker deve estar registrado</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm">Service Worker</span>
          {checks.serviceWorker ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Registrado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Não registrado
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Suporte a Notificações</span>
          {checks.notifications ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Suportado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Não suportado
            </Badge>
          )}
        </div>

        {!checks.envVars && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ Variáveis de ambiente não encontradas
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Verifique se o arquivo <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">.env</code> existe e tem as variáveis <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">VITE_FIREBASE_*</code>. 
              <strong> REINICIE o servidor</strong> após criar/editar o arquivo.
            </p>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 <strong>Dica:</strong> Abra o Console do navegador (F12) para ver logs detalhados de debug.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

