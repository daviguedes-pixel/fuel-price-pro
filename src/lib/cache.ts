/**
 * Utilitário de cache com TTL (Time To Live)
 * Armazena dados no localStorage com timestamp de expiração
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

/**
 * Obtém um item do cache se ainda não expirou
 */
export function getCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(`cache_${key}`);
    if (!item) return null;

    const cacheItem: CacheItem<T> = JSON.parse(item);
    const now = Date.now();

    // Verificar se expirou
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }

    return cacheItem.data;
  } catch (error) {
    console.error(`Erro ao ler cache para chave ${key}:`, error);
    return null;
  }
}

/**
 * Armazena um item no cache com TTL
 * 
 * @param key - Chave do cache
 * @param data - Dados a serem armazenados (serão serializados como JSON)
 * @param ttl - Tempo de vida em milissegundos (padrão: 5 minutos)
 * 
 * @example
 * ```typescript
 * setCache('my_data', ['item1', 'item2'], 10 * 60 * 1000); // 10 minutos
 * ```
 */
export function setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
  try {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
  } catch (error) {
    console.error(`Erro ao salvar cache para chave ${key}:`, error);
    // Se o localStorage estiver cheio, tentar limpar caches antigos
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearExpiredCache();
      // Tentar novamente
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify({
          data,
          timestamp: Date.now(),
          ttl
        }));
      } catch (retryError) {
        console.error('Erro ao salvar cache após limpeza:', retryError);
      }
    }
  }
}

/**
 * Remove um item específico do cache
 */
export function removeCache(key: string): void {
  localStorage.removeItem(`cache_${key}`);
}

/**
 * Limpa todos os caches expirados
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_')) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const cacheItem: CacheItem<any> = JSON.parse(item);
          if (now - cacheItem.timestamp > cacheItem.ttl) {
            keysToRemove.push(key);
          }
        }
      } catch {
        // Se não conseguir parsear, remover
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Limpa todo o cache
 */
export function clearAllCache(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Verifica se uma chave existe no cache e não expirou
 */
export function hasCache(key: string): boolean {
  return getCache(key) !== null;
}

