/**
 * Logger Tests - Comprehensive test suite for Logger class
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, createLogger, type LogEntry, type LogHandler } from '../src/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
    // Suppress console output during tests
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should create logger with default settings', () => {
      const defaultLogger = new Logger();

      expect(defaultLogger).toBeInstanceOf(Logger);
    });

    it('should create logger with custom level', () => {
      const debugLogger = new Logger({ level: 'debug' });

      const handler = vi.fn();
      debugLogger.addHandler(handler);

      debugLogger.debug('test');

      expect(handler).toHaveBeenCalled();
    });

    it('should create logger with scope', () => {
      const handler = vi.fn();
      const scopedLogger = new Logger({
        scope: 'test-plugin',
        level: 'info',
        handlers: [handler]
      });

      scopedLogger.info('message');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'test-plugin',
        })
      );
    });

    it('should create logger disabled', () => {
      const handler = vi.fn();
      const disabledLogger = new Logger({ enabled: false, handlers: [handler] });

      disabledLogger.error('test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should create logger with custom handlers', () => {
      const customHandler = vi.fn();
      const customLogger = new Logger({ handlers: [customHandler] });

      customLogger.warn('test');

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      const handler = vi.fn();
      const debugLogger = new Logger({ level: 'debug', handlers: [handler] });

      debugLogger.debug('debug message');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          message: 'debug message',
        })
      );
    });

    it('should log info messages', () => {
      const handler = vi.fn();
      const infoLogger = new Logger({ level: 'info', handlers: [handler] });

      infoLogger.info('info message');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'info message',
        })
      );
    });

    it('should log warn messages', () => {
      const handler = vi.fn();
      const warnLogger = new Logger({ level: 'warn', handlers: [handler] });

      warnLogger.warn('warn message');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'warn message',
        })
      );
    });

    it('should log error messages', () => {
      const handler = vi.fn();
      const errorLogger = new Logger({ level: 'error', handlers: [handler] });

      errorLogger.error('error message');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: 'error message',
        })
      );
    });

    it('should respect log level threshold (debug)', () => {
      const handler = vi.fn();
      const debugLogger = new Logger({ level: 'debug', handlers: [handler] });

      debugLogger.debug('debug');
      debugLogger.info('info');
      debugLogger.warn('warn');
      debugLogger.error('error');

      expect(handler).toHaveBeenCalledTimes(4);
    });

    it('should respect log level threshold (info)', () => {
      const handler = vi.fn();
      const infoLogger = new Logger({ level: 'info', handlers: [handler] });

      infoLogger.debug('debug');
      infoLogger.info('info');
      infoLogger.warn('warn');
      infoLogger.error('error');

      // debug should be filtered out
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should respect log level threshold (warn)', () => {
      const handler = vi.fn();
      const warnLogger = new Logger({ level: 'warn', handlers: [handler] });

      warnLogger.debug('debug');
      warnLogger.info('info');
      warnLogger.warn('warn');
      warnLogger.error('error');

      // debug and info should be filtered out
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should respect log level threshold (error)', () => {
      const handler = vi.fn();
      const errorLogger = new Logger({ level: 'error', handlers: [handler] });

      errorLogger.debug('debug');
      errorLogger.info('info');
      errorLogger.warn('warn');
      errorLogger.error('error');

      // only error should pass
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should include timestamp in log entry', () => {
      const handler = vi.fn();
      const timestampLogger = new Logger({ handlers: [handler] });

      const beforeTime = Date.now();
      timestampLogger.warn('test');
      const afterTime = Date.now();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );

      const timestamp = handler.mock.calls[0][0].timestamp;
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('child loggers', () => {
    it('should create child logger with scope', () => {
      const handler = vi.fn();
      const parentLogger = new Logger({ handlers: [handler] });

      const childLogger = parentLogger.child('child-scope');
      childLogger.warn('test');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'child-scope',
        })
      );
    });

    it('should inherit parent level', () => {
      const handler = vi.fn();
      const parentLogger = new Logger({ level: 'error', handlers: [handler] });

      const childLogger = parentLogger.child('child');

      childLogger.warn('should not log');
      childLogger.error('should log');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should inherit parent enabled state', () => {
      const handler = vi.fn();
      const parentLogger = new Logger({ enabled: false, handlers: [handler] });

      const childLogger = parentLogger.child('child');
      childLogger.error('test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should inherit parent handlers', () => {
      const handler = vi.fn();
      const parentLogger = new Logger({ handlers: [handler] });

      const childLogger = parentLogger.child('child');
      childLogger.warn('test');

      expect(handler).toHaveBeenCalled();
    });

    it('should chain scopes correctly', () => {
      const handler = vi.fn();
      const parentLogger = new Logger({ scope: 'parent', handlers: [handler] });

      const childLogger = parentLogger.child('child');
      childLogger.warn('test');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'parent:child',
        })
      );
    });

    it('should support nested child loggers', () => {
      const handler = vi.fn();
      const grandparent = new Logger({ scope: 'root', handlers: [handler] });

      const parent = grandparent.child('parent');
      const child = parent.child('child');

      child.warn('test');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'root:parent:child',
        })
      );
    });
  });

  describe('metadata', () => {
    it('should log with metadata', () => {
      const handler = vi.fn();
      const metadataLogger = new Logger({ handlers: [handler] });

      const metadata = { url: 'test.mp4', duration: 120 };
      metadataLogger.warn('test', metadata);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });

    it('should handle complex metadata', () => {
      const handler = vi.fn();
      const complexLogger = new Logger({ handlers: [handler] });

      const complexMetadata = {
        url: 'test.mp4',
        nested: { prop: 'value', arr: [1, 2, 3] },
        timestamp: Date.now(),
      };

      complexLogger.error('test', complexMetadata);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: complexMetadata,
        })
      );
    });

    it('should handle undefined metadata', () => {
      const handler = vi.fn();
      const undefinedLogger = new Logger({ handlers: [handler] });

      undefinedLogger.warn('test', undefined);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: undefined,
        })
      );
    });

    it('should handle empty metadata object', () => {
      const handler = vi.fn();
      const emptyLogger = new Logger({ handlers: [handler] });

      emptyLogger.warn('test', {});

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {},
        })
      );
    });
  });

  describe('handlers', () => {
    it('should call custom handler', () => {
      const customHandler = vi.fn();
      const handlerLogger = new Logger({ handlers: [customHandler] });

      handlerLogger.warn('test');

      expect(customHandler).toHaveBeenCalledTimes(1);
    });

    it('should call multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const multiHandlerLogger = new Logger({ handlers: [handler1, handler2, handler3] });

      multiHandlerLogger.warn('test');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should add handler dynamically', () => {
      const handler = vi.fn();
      const dynamicLogger = new Logger({ handlers: [] });

      dynamicLogger.warn('before');
      expect(handler).not.toHaveBeenCalled();

      dynamicLogger.addHandler(handler);
      dynamicLogger.warn('after');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove handler', () => {
      const handler = vi.fn();
      const removeLogger = new Logger({ handlers: [handler] });

      removeLogger.warn('before');
      expect(handler).toHaveBeenCalledTimes(1);

      removeLogger.removeHandler(handler);
      removeLogger.warn('after');

      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle handler errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const goodHandler = vi.fn();
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      const errorHandlerLogger = new Logger({ handlers: [badHandler, goodHandler] });

      errorHandlerLogger.warn('test');

      expect(errorSpy).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should handle removing non-existent handler', () => {
      const handler = vi.fn();
      const noHandlerLogger = new Logger({ handlers: [] });

      expect(() => noHandlerLogger.removeHandler(handler)).not.toThrow();
    });

    it('should pass complete log entry to handler', () => {
      const handler = vi.fn();
      const entryLogger = new Logger({ scope: 'test', handlers: [handler] });

      entryLogger.warn('message', { key: 'value' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: 'message',
          timestamp: expect.any(Number),
          scope: 'test',
          metadata: { key: 'value' },
        })
      );
    });
  });

  describe('configuration', () => {
    it('should change log level', () => {
      const handler = vi.fn();
      const configLogger = new Logger({ level: 'error', handlers: [handler] });

      configLogger.warn('should not log');
      expect(handler).not.toHaveBeenCalled();

      configLogger.setLevel('warn');
      configLogger.warn('should log');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should enable logging', () => {
      const handler = vi.fn();
      const enableLogger = new Logger({ enabled: false, handlers: [handler] });

      enableLogger.error('before enable');
      expect(handler).not.toHaveBeenCalled();

      enableLogger.setEnabled(true);
      enableLogger.error('after enable');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should disable logging', () => {
      const handler = vi.fn();
      const disableLogger = new Logger({ enabled: true, handlers: [handler] });

      disableLogger.error('before disable');
      expect(handler).toHaveBeenCalledTimes(1);

      disableLogger.setEnabled(false);
      disableLogger.error('after disable');

      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('edge cases', () => {
    it('should handle logging when disabled', () => {
      const handler = vi.fn();
      const disabledLogger = new Logger({ enabled: false, handlers: [handler] });

      disabledLogger.debug('test');
      disabledLogger.info('test');
      disabledLogger.warn('test');
      disabledLogger.error('test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle empty message', () => {
      const handler = vi.fn();
      const emptyLogger = new Logger({ handlers: [handler] });

      emptyLogger.warn('');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
        })
      );
    });

    it('should handle no handlers', () => {
      const noHandlerLogger = new Logger({ handlers: [] });

      expect(() => {
        noHandlerLogger.warn('test');
      }).not.toThrow();
    });

    it('should handle logger without scope', () => {
      const handler = vi.fn();
      const noScopeLogger = new Logger({ handlers: [handler] });

      noScopeLogger.warn('test');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: undefined,
        })
      );
    });
  });

  describe('createLogger factory', () => {
    it('should create logger without scope', () => {
      const factoryLogger = createLogger();

      expect(factoryLogger).toBeInstanceOf(Logger);
    });

    it('should create logger with scope', () => {
      const handler = vi.fn();
      const scopedLogger = createLogger('factory-scope');
      scopedLogger.addHandler(handler);

      scopedLogger.warn('test');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'factory-scope',
        })
      );
    });
  });

  describe('default console handler', () => {
    it('should call console.debug for debug level', () => {
      const debugLogger = new Logger({ level: 'debug' });

      debugLogger.debug('test message');

      expect(console.debug).toHaveBeenCalledWith('[ScarlettPlayer] test message', '');
    });

    it('should call console.info for info level', () => {
      const infoLogger = new Logger({ level: 'info' });

      infoLogger.info('test message');

      expect(console.info).toHaveBeenCalledWith('[ScarlettPlayer] test message', '');
    });

    it('should call console.warn for warn level', () => {
      const warnLogger = new Logger({ level: 'warn' });

      warnLogger.warn('test message');

      expect(console.warn).toHaveBeenCalledWith('[ScarlettPlayer] test message', '');
    });

    it('should call console.error for error level', () => {
      const errorLogger = new Logger({ level: 'error' });

      errorLogger.error('test message');

      expect(console.error).toHaveBeenCalledWith('[ScarlettPlayer] test message', '');
    });

    it('should include scope in console output', () => {
      const scopedLogger = new Logger({ scope: 'test-plugin' });

      scopedLogger.warn('test message');

      expect(console.warn).toHaveBeenCalledWith('[test-plugin] test message', '');
    });

    it('should include metadata in console output', () => {
      const metadataLogger = new Logger();

      metadataLogger.warn('test message', { key: 'value' });

      expect(console.warn).toHaveBeenCalledWith(
        '[ScarlettPlayer] test message',
        { key: 'value' }
      );
    });
  });
});
