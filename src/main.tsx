import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/registerServiceWorker";

console.log('🚀 Main.tsx executado');

// Forçar atualização do favicon ao carregar a aplicação
if (typeof document !== 'undefined') {
  const updateFavicon = () => {
    const timestamp = Date.now();
    const faviconPath = '/lovable-uploads/integra-logo-black.png';
    const faviconUrl = `${faviconPath}?v=${timestamp}`;
    
    // Remover favicons antigos
    const oldLinks = document.querySelectorAll('link[rel*="icon"]');
    oldLinks.forEach(link => link.remove());
    
    // Criar novos links de favicon
    const link1 = document.createElement('link');
    link1.rel = 'icon';
    link1.type = 'image/png';
    link1.href = faviconUrl;
    document.head.appendChild(link1);
    
    const link2 = document.createElement('link');
    link2.rel = 'shortcut icon';
    link2.type = 'image/png';
    link2.href = faviconUrl;
    document.head.appendChild(link2);
    
    const link3 = document.createElement('link');
    link3.rel = 'apple-touch-icon';
    link3.type = 'image/png';
    link3.href = faviconUrl;
    document.head.appendChild(link3);
    
    console.log('✅ Favicon atualizado:', faviconUrl);
  };
  
  // Atualizar imediatamente
  updateFavicon();
  
  // Atualizar também quando a página estiver totalmente carregada
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateFavicon);
  } else {
    updateFavicon();
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
