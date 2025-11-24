import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/registerServiceWorker";

console.log('🚀 Main.tsx executado');

// Verificar e atualizar manifest se necessário
if (typeof document !== 'undefined') {
  const updateManifest = () => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      const manifestHref = manifestLink.getAttribute('href');
      // Adicionar cache busting apenas se necessário
      if (manifestHref && !manifestHref.includes('?v=')) {
        const timestamp = Date.now();
        manifestLink.setAttribute('href', `${manifestHref}?v=${timestamp}`);
        console.log('✅ Manifest atualizado com cache busting');
      }
    }
  };
  
  // Atualizar quando a página estiver totalmente carregada
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateManifest);
  } else {
    updateManifest();
  }
}

try {
  const rootElement = document.getElementById("root");
  console.log('📦 Root element:', rootElement);
  
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  } else {
    console.error('❌ Root element não encontrado!');
  }
} catch (error) {
  console.error('❌ Erro ao inicializar app:', error);
}
