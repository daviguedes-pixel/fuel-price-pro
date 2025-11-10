import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { disableAutoTranslate } from "./lib/disable-translation";

console.log('🚀 Main.tsx executado');
disableAutoTranslate();

try {
  const rootElement = document.getElementById("root");
  console.log('📦 Root element:', rootElement);
  
  if (rootElement) {
    createRoot(rootElement).render(<App />);
    console.log('✅ App renderizado com sucesso');
  } else {
    console.error('❌ Root element não encontrado!');
  }
} catch (error) {
  console.error('❌ Erro ao inicializar app:', error);
}
