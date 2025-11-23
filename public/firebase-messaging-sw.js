// Service Worker para Firebase Cloud Messaging
// IMPORTANTE: Este arquivo deve estar na pasta public/

// Forçar ativação imediata quando instalado
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalando...');
  // Forçar ativação imediata, pulando a fase de espera
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker ativando...');
  // Tomar controle de todas as páginas imediatamente
  event.waitUntil(clients.claim());
  console.log('✅ Service Worker ativado e controlando todas as páginas');
});

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// A configuração será enviada via mensagem do cliente
let messaging = null;
let firebaseInitialized = false;
let backgroundMessageHandlerConfigured = false;

// Escutar mensagem de configuração do cliente
self.addEventListener('message', (event) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📨 MENSAGEM RECEBIDA NO SERVICE WORKER');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Scope:', self.registration.scope);
  console.log('Tipo:', event.data?.type);
  console.log('Dados:', event.data);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Enviar para console principal
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_DEBUG',
        message: '📨 Mensagem recebida no Service Worker',
        data: event.data,
        level: 'info'
      });
    });
  }).catch(err => {
    console.error('Erro ao enviar mensagem para cliente:', err);
  });
  
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const firebaseConfig = event.data.config;
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 CONFIGURAÇÃO DO FIREBASE RECEBIDA NO SERVICE WORKER');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Scope deste Service Worker:', self.registration.scope);
    console.log('Project ID:', firebaseConfig?.projectId);
    console.log('Auth Domain:', firebaseConfig?.authDomain);
    console.log('Has API Key:', !!firebaseConfig?.apiKey);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    try {
      // Sempre reconfigurar, mesmo se já estava inicializado
      console.log('🚀 Inicializando/Reconfigurando Firebase no Service Worker...');
      
      // Tentar obter app existente ou criar novo
      let app;
      try {
        app = firebase.app();
        console.log('ℹ️ Firebase App já existe, usando existente');
      } catch (e) {
        // Se não existe, inicializar
        app = firebase.initializeApp(firebaseConfig);
        console.log('✅ Nova instância do Firebase criada');
      }
      
      // Obter instância do messaging (sempre obter, mesmo se já existe)
      console.log('🔧 Obtendo instância do Firebase Messaging...');
      messaging = firebase.messaging();
      firebaseInitialized = true;
      
      console.log('✅ Firebase Messaging obtido com sucesso!');
      console.log('✅ Firebase inicializado no Service Worker');
      
      // Verificar se messaging foi criado
      if (!messaging) {
        console.error('❌ ERRO: messaging é null após inicialização!');
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_DEBUG',
              message: '❌ ERRO: messaging é null!',
              level: 'error'
            });
          });
        });
        return; // Parar aqui se messaging não foi criado
      }
      
      console.log('✅ Messaging criado com sucesso');
      
      // ENVIAR PRIMEIRA CONFIRMAÇÃO: Firebase inicializado (SEMPRE, independente do listener)
      self.clients.matchAll().then(clients => {
        console.log(`📤 Enviando confirmação de inicialização para ${clients.length} cliente(s)...`);
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_DEBUG',
            message: `✅✅✅ Firebase inicializado no Service Worker (${self.registration.scope}) ✅✅✅`,
            level: 'success',
            scope: self.registration.scope
          });
        });
        console.log('✅ Confirmação de inicialização enviada');
      }).catch(err => {
        console.error('❌ Erro ao enviar confirmação de inicialização:', err);
      });
      
      // Configurar listener de mensagens APENAS UMA VEZ
      // Usar uma variável global para rastrear se já foi configurado
      if (!backgroundMessageHandlerConfigured) {
        console.log('🔧 Configurando listener onBackgroundMessage (primeira vez)...');
        
        messaging.onBackgroundMessage((payload) => {
        console.log('📬 ===== MENSAGEM RECEBIDA NO SERVICE WORKER =====');
        console.log('📋 Payload:', payload);
        
        // Enviar mensagem para o console principal
        self.clients.matchAll().then(clients => {
          console.log(`📤 Enviando mensagem para ${clients.length} cliente(s)...`);
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_LOG',
              level: 'info',
              message: '📬 ===== MENSAGEM RECEBIDA NO SERVICE WORKER =====',
              payload: payload
            });
          });
        }).catch(err => {
          console.error('Erro ao enviar mensagem para cliente:', err);
        });
        
        const notificationTitle = payload.notification?.title || payload.data?.title || 'Nova Notificação';
        const notificationBody = payload.notification?.body || payload.data?.body || payload.data?.message || 'Você tem uma nova notificação';
        
        const notificationOptions = {
          body: notificationBody,
          icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
          badge: '/favicon.ico',
          tag: payload.data?.tag || 'notification',
          data: payload.data || {},
          requireInteraction: false,
          vibrate: [200, 100, 200],
          timestamp: Date.now(),
          silent: false
        };
        
        return self.registration.showNotification(notificationTitle, notificationOptions)
          .then(() => {
            // Enviar sucesso para console principal
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'SW_LOG',
                  level: 'success',
                  message: '✅✅✅ NOTIFICAÇÃO EXIBIDA COM SUCESSO! ✅✅✅',
                  title: notificationTitle,
                  body: notificationBody
                });
              });
            });
          })
          .catch((error) => {
            // Enviar erro para console principal
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'SW_LOG',
                  level: 'error',
                  message: '❌❌❌ ERRO AO EXIBIR NOTIFICAÇÃO',
                  error: error.message,
                  stack: error.stack
                });
              });
            });
          });
        });
        
        // Marcar como configurado para evitar reconfiguração
        backgroundMessageHandlerConfigured = true;
        console.log('✅✅✅ Listener de mensagens em background configurado e ativo ✅✅✅');
        
        // Enviar confirmação de que o listener foi configurado
        self.clients.matchAll().then(clients => {
          console.log(`📤 Enviando confirmação de listener para ${clients.length} cliente(s)...`);
          console.log(`   Scope deste Service Worker: ${self.registration.scope}`);
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_DEBUG',
              message: `✅✅✅ Listener onBackgroundMessage configurado! (${self.registration.scope}) ✅✅✅`,
              level: 'success',
              scope: self.registration.scope
            });
          });
          console.log('✅ Confirmação de listener enviada para console principal');
        }).catch(err => {
          console.error('❌ Erro ao enviar confirmação de listener:', err);
        });
      } else {
        console.log('ℹ️ Listener onBackgroundMessage já estava configurado, pulando...');
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar Firebase no Service Worker:', error);
      console.error('Detalhes:', error.message, error.stack);
    }
  }
});

// Escutar cliques nas notificações
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notificação clicada:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Verificar se já existe uma janela aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não existe, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

