import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeObject } from './sanitize';

describe('Sanitize', () => {
  describe('sanitizeText', () => {
    it('deve remover tags HTML', () => {
      expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert(&quot;xss&quot;)');
      expect(sanitizeText('<div>texto</div>')).toBe('texto');
      // Tags sem conteúdo de texto são completamente removidas
      expect(sanitizeText('<img src="x" onerror="alert(1)">')).toBe('');
      expect(sanitizeText('<br>')).toBe('');
      expect(sanitizeText('<input type="text">')).toBe('');
    });

    it('deve escapar caracteres especiais HTML', () => {
      expect(sanitizeText('a & b')).toBe('a &amp; b');
      expect(sanitizeText('a < b')).toBe('a &lt; b');
      expect(sanitizeText('a > b')).toBe('a &gt; b');
      expect(sanitizeText('a "b"')).toBe('a &quot;b&quot;');
      expect(sanitizeText("a 'b'")).toBe('a &#x27;b&#x27;');
    });

    it('deve retornar string vazia para valores null/undefined', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });

    it('deve preservar texto normal', () => {
      expect(sanitizeText('Texto normal')).toBe('Texto normal');
      expect(sanitizeText('123')).toBe('123');
    });
  });

  describe('sanitizeObject', () => {
    it('deve sanitizar strings no objeto', () => {
      const obj = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
      };

      const sanitized = sanitizeObject(obj);
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.email).toBe('test@example.com');
    });

    it('deve sanitizar objetos aninhados', () => {
      const obj = {
        user: {
          name: '<div>John</div>',
          bio: 'a & b',
        },
      };

      const sanitized = sanitizeObject(obj);
      expect(sanitized.user.name).not.toContain('<div>');
      expect(sanitized.user.bio).toBe('a &amp; b');
    });

    it('deve sanitizar arrays de strings', () => {
      const obj = {
        tags: ['<script>tag1</script>', 'tag2', '<div>tag3</div>'],
      };

      const sanitized = sanitizeObject(obj);
      expect(sanitized.tags[0]).not.toContain('<script>');
      expect(sanitized.tags[1]).toBe('tag2');
      expect(sanitized.tags[2]).not.toContain('<div>');
    });

    it('deve preservar valores não-string', () => {
      const obj = {
        number: 123,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
      };

      const sanitized = sanitizeObject(obj);
      expect(sanitized.number).toBe(123);
      expect(sanitized.boolean).toBe(true);
      expect(sanitized.nullValue).toBe(null);
      expect(sanitized.array).toEqual([1, 2, 3]);
    });
  });
});

