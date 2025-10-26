import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Desabilitar console.log em desenvolvimento para limpar o console
if (import.meta.env.DEV) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  
  console.log = (...args: any[]) => {
    // Opcional: permitir apenas logs importantes
    // if (args[0]?.includes?.('ERROR') || args[0]?.includes?.('SUCCESS')) {
    //   originalLog(...args);
    // }
  };
  
  console.warn = () => {}; // Silenciar warnings
}

createRoot(document.getElementById("root")!).render(<App />);
