import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve logar em desenvolvimento', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    logger.log('test');
    
    // Em desenvolvimento, deve logar
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('sempre deve logar erros', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    logger.error('error test');
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('error test');
    
    consoleErrorSpy.mockRestore();
  });

  it('sempre deve logar warnings', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    logger.warn('warning test');
    
    expect(consoleWarnSpy).toHaveBeenCalledWith('warning test');
    
    consoleWarnSpy.mockRestore();
  });
});

