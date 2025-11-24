/**
 * Utilitário para sanitização de strings e prevenção de XSS
 */

/**
 * Sanitiza uma string removendo tags HTML perigosas
 * Para uso em mensagens de notificação e exibição de texto
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  // Remove tags HTML
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Escapa caracteres especiais HTML
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return sanitized;
}

/**
 * Sanitiza um objeto removendo propriedades perigosas
 */
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

