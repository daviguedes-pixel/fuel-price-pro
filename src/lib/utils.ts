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