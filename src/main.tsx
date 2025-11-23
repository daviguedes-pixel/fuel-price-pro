import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/registerServiceWorker";

console.log('🚀 Main.tsx executado');

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
