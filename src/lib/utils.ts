import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Função para converter formato brasileiro (vírgula) para internacional (ponto)
export function parseBrazilianDecimal(value: string | number): number {
  if (typeof value === 'number') return value;
  
  // Remove espaços e converte vírgula para ponto
  const cleanValue = value.toString().trim().replace(',', '.');
  
  // Converte para número
  const parsed = parseFloat(cleanValue);
  
  // Retorna NaN se não conseguir converter
  return isNaN(parsed) ? 0 : parsed;
}

// Função para formatar número para exibição brasileira
export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Função para converter número inteiro (centavos) para formato de exibição com vírgula fixa
// Ex: 350 -> "3,50", 100 -> "1,00"
export function formatIntegerToPrice(integerValue: string | number): string {
  if (!integerValue && integerValue !== 0) return '';
  const num = typeof integerValue === 'string' ? parseInt(integerValue.replace(/\D/g, ''), 10) : integerValue;
  if (isNaN(num)) return '';
  const reais = Math.floor(num / 100);
  const centavos = num % 100;
  return `${reais},${centavos.toString().padStart(2, '0')}`;
}

// Função para converter formato de exibição (com vírgula) para número inteiro (centavos)
// Ex: "3,50" -> 350, "1,00" -> 100
export function parsePriceToInteger(priceString: string): number {
  if (!priceString) return 0;
  // Remove tudo exceto números
  const cleanValue = priceString.replace(/\D/g, '');
  return parseInt(cleanValue, 10) || 0;
}

// Função para gerar UUID v4 compatível (funciona em todos os ambientes)
export function generateUUID(): string {
  // Verificar se crypto.randomUUID está disponível (navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: gerar UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}