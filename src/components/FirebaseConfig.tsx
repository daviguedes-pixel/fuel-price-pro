import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  vapidKey: string;
}

export function FirebaseConfig() {
  const [config, setConfig] = useState<FirebaseConfig>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
    vapidKey: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // Carregar configuração salva
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      // Tentar carregar do localStorage primeiro (mais rápido)
      const savedConfig = localStorage.getItem('firebase_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        setIsConfigured(true);
        console.log('✅ Configuração do Firebase carregada do localStorage');
        return;
      }

      // Se não tiver no localStorage, tentar carregar do banco
      const { data, error } = await supabase
        .from('app_settings' as any)
        .select('value')
        .eq('key', 'firebase_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST205') {
        console.warn('Erro ao carregar configuração do banco:', error);
      }

      if (data?.value) {
        const parsed = JSON.parse(data.value);
        setConfig(parsed);
        setIsConfigured(true);
        // Salvar no localStorage também
        localStorage.setItem('firebase_config', data.value);
        console.log('✅ Configuração do Firebase carregada do banco');
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validar campos obrigatórios
      if (!config.apiKey || !config.projectId || !config.vapidKey) {
        toast.error('Preencha pelo menos: API Key, Project ID e VAPID Key');
        return;
      }

      const configJson = JSON.stringify(config);

      // Salvar no localStorage (sempre)
      localStorage.setItem('firebase_config', configJson);
      console.log('✅ Configuração salva no localStorage');

      // Tentar salvar no banco também (opcional)
      try {
        const { error } = await supabase
          .from('app_settings' as any)
          .upsert({
            key: 'firebase_config',
            value: configJson,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });

        if (error && error.code !== 'PGRST205') {
          console.warn('Não foi possível salvar no banco (tabela pode não existir):', error);
          // Não é crítico, continuar
        } else {
          console.log('✅ Configuração salva no banco');
        }
      } catch (dbError) {
        console.warn('Erro ao salvar no banco (não crítico):', dbError);
      }

      // Atualizar variáveis de ambiente dinamicamente
      updateEnvVars(config);

      setIsConfigured(true);
      toast.success('Configuração do Firebase salva!', {
        description: 'Recarregue a página para aplicar as mudanças.',
        duration: 5000
      });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  // Atualizar variáveis de ambiente dinamicamente (para uso imediato)
  const updateEnvVars = (newConfig: FirebaseConfig) => {
    // Criar um objeto global para acesso
    if (typeof window !== 'undefined') {
      (window as any).__FIREBASE_CONFIG__ = newConfig;
      console.log('✅ Configuração do Firebase disponível globalmente');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuração do Firebase</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuração do Firebase
        </CardTitle>
        <CardDescription>
          Configure as credenciais do Firebase para habilitar notificações push. 
          Essas informações são salvas localmente no navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Configuração salva. Recarregue a página para aplicar.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="AIzaSy..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authDomain">Auth Domain</Label>
            <Input
              id="authDomain"
              value={config.authDomain}
              onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
              placeholder="projeto.firebaseapp.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectId">Project ID *</Label>
            <Input
              id="projectId"
              value={config.projectId}
              onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
              placeholder="meu-projeto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storageBucket">Storage Bucket</Label>
            <Input
              id="storageBucket"
              value={config.storageBucket}
              onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
              placeholder="projeto.appspot.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="messagingSenderId">Messaging Sender ID</Label>
            <Input
              id="messagingSenderId"
              value={config.messagingSenderId}
              onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value })}
              placeholder="123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appId">App ID</Label>
            <Input
              id="appId"
              value={config.appId}
              onChange={(e) => setConfig({ ...config, appId: e.target.value })}
              placeholder="1:123456789:web:abc123"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurementId">Measurement ID</Label>
            <Input
              id="measurementId"
              value={config.measurementId}
              onChange={(e) => setConfig({ ...config, measurementId: e.target.value })}
              placeholder="G-XXXXXXXXXX"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vapidKey">VAPID Key *</Label>
            <Input
              id="vapidKey"
              type="password"
              value={config.vapidKey}
              onChange={(e) => setConfig({ ...config, vapidKey: e.target.value })}
              placeholder="BP_..."
            />
            <p className="text-xs text-muted-foreground">
              Obtenha no Firebase Console: Configurações do Projeto &gt; Cloud Messaging &gt; Web Push certificates
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Recarregar a página para aplicar as mudanças?')) {
                window.location.reload();
              }
            }}
          >
            Recarregar Página
          </Button>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> As configurações são salvas localmente no navegador. 
            Para usar em outros dispositivos, você precisará configurar novamente.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

