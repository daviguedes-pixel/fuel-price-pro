import { describe, it, expect } from 'vitest';
import {
  parseBrazilianDecimal,
  formatBrazilianCurrency,
  formatIntegerToPrice,
  parsePriceToInteger,
  generateUUID,
  cn,
} from './utils';

describe('Utils', () => {
  describe('parseBrazilianDecimal', () => {
    it('deve converter string com vírgula para número', () => {
      expect(parseBrazilianDecimal('5,50')).toBe(5.5);
      expect(parseBrazilianDecimal('10,99')).toBe(10.99);
    });

    it('deve converter string com ponto para número', () => {
      expect(parseBrazilianDecimal('5.50')).toBe(5.5);
    });

    it('deve retornar número se receber número', () => {
      expect(parseBrazilianDecimal(5.5)).toBe(5.5);
      expect(parseBrazilianDecimal(10)).toBe(10);
    });

    it('deve retornar 0 para valores inválidos', () => {
      expect(parseBrazilianDecimal('')).toBe(0);
      expect(parseBrazilianDecimal('abc')).toBe(0);
    });

    it('deve remover espaços', () => {
      expect(parseBrazilianDecimal(' 5,50 ')).toBe(5.5);
    });
  });

  describe('formatBrazilianCurrency', () => {
    it('deve formatar número como moeda brasileira', () => {
      const formatted = formatBrazilianCurrency(5.5);
      expect(formatted).toContain('5,50');
      expect(formatted).toContain('R$');
    });

    it('deve formatar valores grandes corretamente', () => {
      const formatted = formatBrazilianCurrency(1000.99);
      expect(formatted).toContain('1.000,99');
    });
  });

  describe('formatIntegerToPrice', () => {
    it('deve converter centavos para formato com vírgula', () => {
      expect(formatIntegerToPrice(350)).toBe('3,50');
      expect(formatIntegerToPrice(100)).toBe('1,00');
      expect(formatIntegerToPrice(0)).toBe('0,00');
    });

    it('deve converter string para formato com vírgula', () => {
      expect(formatIntegerToPrice('350')).toBe('3,50');
      expect(formatIntegerToPrice('100')).toBe('1,00');
    });

    it('deve retornar string vazia para valores inválidos', () => {
      expect(formatIntegerToPrice('')).toBe('');
      expect(formatIntegerToPrice('abc')).toBe('');
    });
  });

  describe('parsePriceToInteger', () => {
    it('deve converter formato com vírgula para centavos', () => {
      expect(parsePriceToInteger('3,50')).toBe(350);
      expect(parsePriceToInteger('1,00')).toBe(100);
    });

    it('deve converter formato com ponto para centavos', () => {
      expect(parsePriceToInteger('3.50')).toBe(350);
    });

    it('deve remover caracteres não numéricos', () => {
      expect(parsePriceToInteger('R$ 3,50')).toBe(350);
      expect(parsePriceToInteger('3,50 reais')).toBe(350);
    });

    it('deve retornar 0 para strings vazias', () => {
      expect(parsePriceToInteger('')).toBe(0);
    });
  });

  describe('generateUUID', () => {
    it('deve gerar UUID válido', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('deve gerar UUIDs diferentes', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('cn', () => {
    it('deve combinar classes CSS', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('deve mesclar classes com tailwind-merge', () => {
      // tailwind-merge remove classes conflitantes
      const result = cn('p-4', 'p-2');
      expect(result).toBe('p-2'); // p-2 sobrescreve p-4
    });

    it('deve lidar com valores condicionais', () => {
      expect(cn('class1', false && 'class2', 'class3')).toBe('class1 class3');
    });
  });
});

