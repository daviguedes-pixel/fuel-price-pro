import { describe, it, expect } from 'vitest';
import {
  priceSuggestionSchema,
  referenceRegistrationSchema,
  editRequestSchema,
  validateWithSchema,
  getValidationErrors,
} from './validations';

describe('Validations', () => {
  describe('priceSuggestionSchema', () => {
    it('deve validar dados corretos', () => {
      const validData = {
        station_id: '123',
        client_id: '456',
        product: 'gasolina_comum',
        suggested_price: '5.50',
      };

      const result = validateWithSchema(priceSuggestionSchema, validData);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar dados inválidos', () => {
      const invalidData = {
        station_id: '',
        client_id: '',
        product: '',
      };

      const result = validateWithSchema(priceSuggestionSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = getValidationErrors(result.errors);
        expect(errors['station_id']).toBeDefined();
        expect(errors['client_id']).toBeDefined();
        expect(errors['product']).toBeDefined();
      }
    });
  });

  describe('referenceRegistrationSchema', () => {
    it('deve validar dados corretos', () => {
      const validData = {
        station_id: '123',
        product: 'gasolina_comum',
        reference_price: '5.50',
      };

      const result = validateWithSchema(referenceRegistrationSchema, validData);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar preço inválido', () => {
      const invalidData = {
        station_id: '123',
        product: 'gasolina_comum',
        reference_price: '0',
      };

      const result = validateWithSchema(referenceRegistrationSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('editRequestSchema', () => {
    it('deve validar dados corretos', () => {
      const validData = {
        station_id: '123',
        client_id: '456',
        product: 'gasolina_comum',
        payment_method_id: '789',
        cost_price: '5.50',
      };

      const result = validateWithSchema(editRequestSchema, validData);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar preço de custo inválido', () => {
      const invalidData = {
        station_id: '123',
        client_id: '456',
        product: 'gasolina_comum',
        payment_method_id: '789',
        cost_price: '0',
      };

      const result = validateWithSchema(editRequestSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });
});

