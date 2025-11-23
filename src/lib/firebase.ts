// Configuração do Firebase Cloud Messaging
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging';

// Configuração do Firebase (você precisará obter essas credenciais do Firebase Console)
// https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Debug: Log da configuração (sem valores sensíveis)
console.log('🔧 Firebase Config Check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasAppId: !!firebaseConfig.appId,
  projectId: firebaseConfig.projectId
});

// Inicializar Firebase
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

// Listener global para mensagens do Service Worker (configurado uma vez)
let messageHandlerConfigured = false;

const configureServiceWorkerMessageHandler = () => {
  if (messageHandlerConfigured) {
    return; // Já configurado
  }
  
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  
  const messageHandler = (event: MessageEvent) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📨 MENSAGEM DO SERVICE WORKER RECEBIDA');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Tipo:', event.data?.type);
    console.log('Dados completos:', event.data);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    if (event.data && event.data.type === 'SW_DEBUG') {
      if (event.data.level === 'success') {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅✅✅', event.data.message);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
      } else if (event.data.level === 'error') {
        console.error('');
        console.error('═══════════════════════════════════════════════════════');
        console.error('❌❌❌', event.data.message);
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
      } else {
        console.log('🔍 DEBUG DO SERVICE WORKER:', event.data.message);
      }
    } else if (event.data && event.data.type === 'SW_LOG') {
      if (event.data.level === 'info') {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📬 ===== MENSAGEM RECEBIDA NO SERVICE WORKER =====');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📋 Payload completo:', event.data.payload);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
      } else if (event.data.level === 'success') {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅✅✅ NOTIFICAÇÃO EXIBIDA COM SUCESSO! ✅✅✅');
        console.log('═══════════════════════════════════════════════════════');
        console.log('   Título:', event.data.title);
        console.log('   Corpo:', event.data.body);
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
      } else if (event.data.level === 'error') {
        console.error('');
        console.error('═══════════════════════════════════════════════════════');
        console.error('❌❌❌ ERRO AO EXIBIR NOTIFICAÇÃO');
        console.error('═══════════════════════════════════════════════════════');
        console.error('   Erro:', event.data.error);
        console.error('   Stack:', event.data.stack);
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
      }
    }
  };
  
  navigator.serviceWorker.addEventListener('message', messageHandler);
  messageHandlerConfigured = true;
  console.log('✅✅✅ Listener global de mensagens do Service Worker configurado ✅✅✅');
  console.log('   Todas as mensagens do Service Worker aparecerão aqui no console!');
};

// Configurar o listener assim que o módulo carregar
if (typeof window !== 'undefined') {
  configureServiceWorkerMessageHandler();
}

export const initFirebase = async (): Promise<{ app: FirebaseApp; messaging: Messaging | null }> => {
  console.log('🚀 initFirebase chamado');
  
  // Se app já existe mas messaging ainda não foi inicializado, continuar inicialização
  if (app && messaging) {
    console.log('✅ Firebase App e Messaging já inicializados, retornando existente');
    return { app, messaging };
  }
  
  if (app && !messaging) {
    console.log('⚠️ Firebase App existe mas Messaging não foi inicializado ainda, continuando inicialização...');
    // Continuar para inicializar messaging
  }

  // Verificar se Firebase está configurado
  console.log('🔍 Verificando configuração do Firebase:');
  console.log('   apiKey:', firebaseConfig.apiKey ? `✅ (${firebaseConfig.apiKey.substring(0, 10)}...)` : '❌ VAZIO');
  console.log('   projectId:', firebaseConfig.projectId ? `✅ (${firebaseConfig.projectId})` : '❌ VAZIO');
  console.log('   authDomain:', firebaseConfig.authDomain ? `✅ (${firebaseConfig.authDomain})` : '❌ VAZIO');
  console.log('   appId:', firebaseConfig.appId ? `✅ (${firebaseConfig.appId.substring(0, 20)}...)` : '❌ VAZIO');
  
  // Verificar variáveis de ambiente diretamente
  console.log('🔍 Verificando variáveis de ambiente (import.meta.env):');
  console.log('   VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? `✅ (${import.meta.env.VITE_FIREBASE_API_KEY.substring(0, 10)}...)` : '❌ NÃO ENCONTRADA');
  console.log('   VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? `✅ (${import.meta.env.VITE_FIREBASE_PROJECT_ID})` : '❌ NÃO ENCONTRADA');
  console.log('   VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? `✅ (${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN})` : '❌ NÃO ENCONTRADA');
  console.log('   VITE_FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? `✅ (${import.meta.env.VITE_FIREBASE_APP_ID.substring(0, 20)}...)` : '❌ NÃO ENCONTRADA');
  console.log('   VITE_FIREBASE_VAPID_KEY:', import.meta.env.VITE_FIREBASE_VAPID_KEY ? `✅ (${import.meta.env.VITE_FIREBASE_VAPID_KEY.substring(0, 10)}...)` : '❌ NÃO ENCONTRADA');

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ Firebase não está configurado!');
    console.error('');
    console.error('📋 DIAGNÓSTICO:');
    console.error('   - As variáveis de ambiente não estão sendo lidas');
    console.error('   - Possíveis causas:');
    console.error('     1. Arquivo .env não existe na raiz do projeto');
    console.error('     2. Arquivo .env não tem as variáveis VITE_FIREBASE_*');
    console.error('     3. Servidor não foi reiniciado após criar/editar .env');
    console.error('     4. Arquivo .env está em local errado (deve estar na raiz, mesmo nível que package.json)');
    console.error('');
    console.error('💡 SOLUÇÃO:');
    console.error('   1. Crie/edite o arquivo .env na raiz do projeto');
    console.error('   2. Adicione as variáveis VITE_FIREBASE_*');
    console.error('   3. PARE o servidor (Ctrl+C)');
    console.error('   4. REINICIE o servidor (npm run dev)');
    console.error('   5. Recarregue a página (Ctrl+Shift+R)');
    return { app: null as any, messaging: null };
  }

  // Inicializar app (se ainda não foi inicializado)
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase App inicializado');
    } else {
      app = getApps()[0];
      console.log('✅ Firebase App já estava inicializado (getApps)');
    }
  } else {
    console.log('✅ Firebase App já existe, usando existente');
  }

  // Verificar e registrar Service Worker ANTES de inicializar Messaging
  let serviceWorkerReady = false;
  console.log('🔍 Verificando Service Worker...');
  console.log('   serviceWorker suportado:', 'serviceWorker' in navigator ? '✅' : '❌');
  
  if ('serviceWorker' in navigator) {
    try {
      console.log('📝 Verificando se Service Worker já está registrado...');
      // Verificar se já está registrado
      let registration = await navigator.serviceWorker.getRegistration();
      
      if (!registration) {
        console.log('📝 Service Worker não encontrado, registrando...');
        console.log('   Tentando registrar: /firebase-messaging-sw.js');
        // Registrar service worker se não estiver registrado
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        console.log('✅ Service Worker registrado com sucesso!');
        console.log('   Scope:', registration.scope);
        console.log('   Active:', registration.active ? '✅' : '❌');
        console.log('   Installing:', registration.installing ? '✅' : '❌');
        console.log('   Waiting:', registration.waiting ? '✅' : '❌');
      } else {
        console.log('✅ Service Worker já estava registrado');
        console.log('   Scope:', registration.scope);
        console.log('   Active:', registration.active ? '✅' : '❌');
      }

      console.log('⏳ Aguardando Service Worker estar pronto...');
      // Aguardar service worker estar pronto
      await navigator.serviceWorker.ready;
      serviceWorkerReady = true;
      console.log('✅ Service Worker pronto!');
      
      // Garantir que o listener global está configurado
      configureServiceWorkerMessageHandler();
      
      // Aguardar um pouco para garantir que o listener está ativo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Listar TODOS os Service Workers registrados
      console.log('🔍 Buscando TODOS os Service Workers registrados...');
      const allRegistrations = await navigator.serviceWorker.getRegistrations();
      console.log(`📋 Encontrados ${allRegistrations.length} Service Worker(s) registrado(s):`);
      allRegistrations.forEach((reg, index) => {
        console.log(`   ${index + 1}. Scope: ${reg.scope}`);
        console.log(`      Active: ${reg.active ? '✅' : '❌'}`);
        console.log(`      Waiting: ${reg.waiting ? '⚠️' : '✅'}`);
        console.log(`      Installing: ${reg.installing ? '⏳' : '✅'}`);
      });
      
      // Função para enviar configuração para um Service Worker
      const sendConfigToSW = (sw: ServiceWorker | null, scope: string) => {
        if (!sw) {
          console.warn(`⚠️ Service Worker não está ativo para scope: ${scope}`);
          return;
        }
        
        console.log(`📤 Enviando configuração para Service Worker: ${scope}`);
        console.log(`   State: ${sw.state}`);
        
        try {
          sw.postMessage({
            type: 'FIREBASE_CONFIG',
            config: firebaseConfig
          });
          console.log(`✅ Mensagem enviada para Service Worker: ${scope}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar mensagem para Service Worker ${scope}:`, error);
        }
      };
      
      // Enviar configuração para TODOS os Service Workers ativos
      console.log('');
      console.log('🔧 Enviando configuração do Firebase para TODOS os Service Workers...');
      console.log('📋 Config:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        hasApiKey: !!firebaseConfig.apiKey
      });
      
      let sentCount = 0;
      for (const reg of allRegistrations) {
        if (reg.active) {
          sendConfigToSW(reg.active, reg.scope);
          sentCount++;
        } else if (reg.waiting) {
          sendConfigToSW(reg.waiting, reg.scope);
          sentCount++;
        } else if (reg.installing) {
          // Aguardar instalação e então enviar
          reg.installing.addEventListener('statechange', () => {
            if (reg.installing?.state === 'activated' && reg.active) {
              sendConfigToSW(reg.active, reg.scope);
            }
          });
        }
      }
      
      console.log(`✅ Configuração enviada para ${sentCount} Service Worker(s)`);
      
      // Tentar novamente após 1 segundo (caso algum Service Worker ainda esteja inicializando)
      setTimeout(() => {
        console.log('🔄 Tentando enviar configuração novamente para todos os Service Workers...');
        allRegistrations.forEach(reg => {
          if (reg.active) {
            sendConfigToSW(reg.active, reg.scope);
          }
        });
      }, 1000);
      
      // Aguardar confirmação do Service Worker
      setTimeout(() => {
        console.log('');
        console.log('🔍 Verificando se Service Worker recebeu a configuração...');
        console.log('   Se apareceu "✅✅✅ Firebase inicializado no Service Worker ✅✅✅" acima, está OK!');
        console.log('   Se NÃO apareceu, verifique o console do Service Worker (Application > Service Workers > Inspect)');
        console.log('');
      }, 3000);
    } catch (error: any) {
      console.error('❌ Erro ao configurar service worker!');
      console.error('   Erro:', error);
      console.error('   Mensagem:', error?.message);
      console.error('   Stack:', error?.stack);
      serviceWorkerReady = false;
    }
  } else {
    console.warn('⚠️ Service Workers não são suportados neste navegador');
    console.warn('   Firebase Messaging requer Service Worker');
  }
  
  console.log('📋 Status do Service Worker:', serviceWorkerReady ? '✅ PRONTO' : '❌ NÃO PRONTO');

  // Inicializar Messaging
  // Em localhost, sempre tentar inicializar (mesmo se isSupported retornar false)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isHTTPS = window.location.protocol === 'https:';
  const isSecureContext = isHTTPS || isLocalhost;
  
  console.log('🔍 Verificando contexto:', {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    isLocalhost: isLocalhost,
    isHTTPS: isHTTPS,
    isSecureContext: isSecureContext
  });

  let messagingSupported = false;
  
  if (isSecureContext) {
    // Em contexto seguro (localhost ou HTTPS), tentar verificar suporte
    try {
      messagingSupported = await isSupported();
      console.log('🔍 Firebase Messaging suportado?', messagingSupported);
      
      // Se isSupported retornar false mas estivermos em localhost, tentar mesmo assim
      if (!messagingSupported && isLocalhost) {
        console.log('🔓 Localhost detectado, tentando inicializar mesmo assim...');
        messagingSupported = true;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao verificar suporte do Firebase Messaging:', error);
      // Em localhost, tentar mesmo assim
      if (isLocalhost) {
        console.log('🔓 Localhost detectado, tentando inicializar mesmo assim...');
        messagingSupported = true;
      }
    }
  } else {
    console.warn('⚠️ Contexto não seguro. Firebase Messaging requer HTTPS ou localhost.');
  }

  // Só inicializar messaging se ainda não foi inicializado
  if (!messaging && messagingSupported && serviceWorkerReady) {
    try {
      console.log('🚀 Inicializando Firebase Messaging...');
      messaging = getMessaging(app);
      console.log('✅ Firebase Messaging inicializado com sucesso');
    } catch (error: any) {
      console.error('❌ Erro ao inicializar Firebase Messaging!');
      console.error('📋 Erro completo:', error);
      console.error('📋 Mensagem:', error?.message);
      console.error('📋 Código:', error?.code);
      console.error('📋 Nome:', error?.name);
      console.error('📋 Stack:', error?.stack);
      
      // Verificar se é erro de service worker
      if (error?.message?.includes('service worker') || error?.code === 'messaging/unsupported-browser') {
        console.error('💡 Firebase Messaging requer Service Worker. Verifique se está usando HTTPS ou localhost.');
      }
      
      // Tentar inicializar mesmo assim em localhost
      if (isLocalhost) {
        console.log('🔓 Tentando inicializar em localhost mesmo com erro...');
        try {
          messaging = getMessaging(app);
          console.log('✅ Firebase Messaging inicializado com sucesso (localhost)');
        } catch (e: any) {
          console.error('❌ Falha mesmo em localhost:', e);
        }
      }
    }
  } else {
    console.warn('⚠️ Firebase Messaging não será inicializado');
    console.warn('📋 Razões:');
    if (!messagingSupported) {
      console.warn('   - Firebase Messaging não é suportado neste navegador');
    }
    if (!serviceWorkerReady) {
      console.warn('   - Service Worker não está pronto');
    }
    console.log('📋 Verificações detalhadas:', {
      isHTTPS: window.location.protocol === 'https:',
      isLocalhost: window.location.hostname === 'localhost',
      hasServiceWorker: 'serviceWorker' in navigator,
      serviceWorkerReady: serviceWorkerReady,
      messagingSupported: messagingSupported,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    });
    
    // Tentar inicializar mesmo assim em localhost
    if (isLocalhost && serviceWorkerReady) {
      console.log('🔓 Tentando inicializar em localhost mesmo sem suporte confirmado...');
      try {
        messaging = getMessaging(app);
        console.log('✅ Firebase Messaging inicializado com sucesso (localhost fallback)');
      } catch (error: any) {
        console.error('❌ Falha ao inicializar em localhost:', error);
      }
    }
  }

  console.log('📋 Retornando resultado final:');
  console.log('   app:', app ? '✅' : '❌');
  console.log('   messaging:', messaging ? '✅' : '❌');
  
  return { app, messaging };
};

export const getFirebaseMessaging = () => messaging;

// Solicitar permissão e obter token FCM
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    console.log('🔔 Iniciando solicitação de permissão de notificação...');
    
    const { messaging } = await initFirebase();
    
    if (!messaging) {
      console.error('❌ Firebase Messaging não está disponível');
      console.log('Verificando configuração:', {
        apiKey: firebaseConfig.apiKey ? '✅' : '❌',
        projectId: firebaseConfig.projectId ? '✅' : '❌',
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅' : '❌'
      });
      return null;
    }

    console.log('✅ Firebase Messaging inicializado');

    // Solicitar permissão
    console.log('📱 Solicitando permissão do navegador...');
    const permission = await Notification.requestPermission();
    console.log('📱 Permissão:', permission);
    
    if (permission !== 'granted') {
      console.warn('❌ Permissão de notificação negada:', permission);
      return null;
    }

    console.log('✅ Permissão concedida');

    // Obter token FCM
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
    
    if (!vapidKey) {
      console.error('❌ VAPID Key não configurada. Configure VITE_FIREBASE_VAPID_KEY no .env');
      return null;
    }

    console.log('🔑 VAPID Key encontrada, obtendo token FCM...');
    const token = await getToken(messaging, { vapidKey });
    
    if (token) {
      console.log('✅ Token FCM obtido:', token.substring(0, 50) + '...');
      return token;
    } else {
      console.warn('❌ Não foi possível obter token FCM');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao solicitar permissão de notificação:', error);
    console.error('Detalhes do erro:', error);
    return null;
  }
};

// Escutar mensagens quando o app está em primeiro plano
export const onMessageListener = () => {
  return new Promise((resolve) => {
    initFirebase().then(({ messaging }) => {
      if (messaging) {
        onMessage(messaging, (payload) => {
          console.log('📬 Mensagem recebida em primeiro plano:', payload);
          resolve(payload);
        });
      }
    });
  });
};

export { app, messaging };

