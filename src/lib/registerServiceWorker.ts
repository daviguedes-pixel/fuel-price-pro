// Registrar Service Worker para Firebase Cloud Messaging
export const registerServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Workers não são suportados neste navegador');
    return null;
  }

  try {
    // Verificar se já está registrado
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      console.log('✅ Service Worker já estava registrado:', existing.scope);
      await navigator.serviceWorker.ready;
      return existing;
    }

    // Registrar o service worker
    console.log('📝 Registrando Service Worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    console.log('✅ Service Worker registrado:', registration.scope);

    // Aguardar o service worker estar pronto
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker pronto e ativo');

    return registration;
  } catch (error: any) {
    console.error('❌ Erro ao registrar Service Worker:', error);
    console.error('Detalhes:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack
    });
    return null;
  }
};

// Inicializar quando o app carregar
if (typeof window !== 'undefined') {
  // Registrar após um pequeno delay para garantir que tudo está carregado
  setTimeout(() => {
    registerServiceWorker();
  }, 1000);
}

