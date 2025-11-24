/**
 * Utilitário de logging que remove logs em produção
 * Mantém apenas erros e warnings em produção
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Erros sempre logam, mesmo em produção
    console.error(...args);
  },
  
  warn: (...args: any[]) => {
    // Warnings sempre logam, mesmo em produção
    console.warn(...args);
  },
  
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  
  // Para logs que devem sempre aparecer (ex: erros críticos)
  always: (...args: any[]) => {
    console.log(...args);
  }
};

