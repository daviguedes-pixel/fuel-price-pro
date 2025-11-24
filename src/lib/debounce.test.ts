import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from './debounce';

describe('Debounce and Throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debounce', () => {
    it('deve executar função apenas após período de inatividade', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 1000);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it('deve cancelar execução anterior se chamado novamente', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 1000);

      debouncedFunc();
      vi.advanceTimersByTime(500);
      
      debouncedFunc(); // Cancela a anterior
      vi.advanceTimersByTime(500);
      
      expect(func).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(500);
      
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('deve passar argumentos corretamente', () => {
      const func = vi.fn();
      const debouncedFunc = debounce(func, 1000);

      debouncedFunc('arg1', 'arg2');
      vi.advanceTimersByTime(1000);

      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    it('deve executar função imediatamente na primeira chamada', () => {
      const func = vi.fn();
      const throttledFunc = throttle(func, 1000);

      throttledFunc();

      expect(func).toHaveBeenCalledTimes(1);
    });

    it('deve ignorar chamadas durante o período de throttle', () => {
      const func = vi.fn();
      const throttledFunc = throttle(func, 1000);

      throttledFunc();
      throttledFunc();
      throttledFunc();

      expect(func).toHaveBeenCalledTimes(1);
    });

    it('deve permitir nova execução após período', () => {
      const func = vi.fn();
      const throttledFunc = throttle(func, 1000);

      throttledFunc();
      expect(func).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);

      throttledFunc();
      expect(func).toHaveBeenCalledTimes(2);
    });

    it('deve passar argumentos corretamente', () => {
      const func = vi.fn();
      const throttledFunc = throttle(func, 1000);

      throttledFunc('arg1', 'arg2');

      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});

