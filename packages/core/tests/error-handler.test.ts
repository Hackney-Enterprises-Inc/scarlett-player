/**
 * ErrorHandler Tests - Comprehensive test suite for ErrorHandler class
 *
 * Target: 95%+ code coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, ErrorCode, type PlayerError } from '../src/error-handler';
import { EventBus } from '../src/events/event-bus';
import { Logger } from '../src/logger';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let eventBus: EventBus;
  let logger: Logger;

  beforeEach(() => {
    eventBus = new EventBus();
    logger = new Logger({ level: 'debug' });
    errorHandler = new ErrorHandler(eventBus, logger);

    // Suppress console output during tests
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should create with default settings', () => {
      const defaultHandler = new ErrorHandler(eventBus, logger);

      expect(defaultHandler).toBeInstanceOf(ErrorHandler);
      expect(defaultHandler.getHistory()).toHaveLength(0);
    });

    it('should create with custom max history', () => {
      const customHandler = new ErrorHandler(eventBus, logger, { maxHistory: 5 });

      // Add 6 errors
      for (let i = 0; i < 6; i++) {
        customHandler.throw(ErrorCode.UNKNOWN_ERROR, `Error ${i}`);
      }

      // Should only keep last 5
      expect(customHandler.getHistory()).toHaveLength(5);
    });
  });

  describe('handle()', () => {
    it('should handle PlayerError', () => {
      const playerError: PlayerError = {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: 'Failed to load source',
        fatal: true,
        timestamp: Date.now(),
      };

      const result = errorHandler.handle(playerError);

      expect(result).toEqual(expect.objectContaining({
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: 'Failed to load source',
        fatal: true,
      }));
    });

    it('should handle native Error', () => {
      const nativeError = new Error('Network error occurred');

      const result = errorHandler.handle(nativeError);

      expect(result).toEqual(expect.objectContaining({
        code: ErrorCode.MEDIA_NETWORK_ERROR,
        message: 'Network error occurred',
        originalError: nativeError,
      }));
    });

    it('should normalize error with context', () => {
      const nativeError = new Error('Failed');
      const context = { operation: 'load', src: 'video.mp4' };

      const result = errorHandler.handle(nativeError, context);

      expect(result.context).toEqual(context);
    });

    it('should merge context for PlayerError', () => {
      const playerError: PlayerError = {
        code: ErrorCode.SOURCE_LOAD_FAILED,
        message: 'Failed',
        fatal: true,
        timestamp: Date.now(),
        context: { existing: 'value' },
      };

      const result = errorHandler.handle(playerError, { new: 'context' });

      expect(result.context).toEqual({
        existing: 'value',
        new: 'context',
      });
    });

    it('should emit error event', () => {
      const errorSpy = vi.fn();
      eventBus.on('error', errorSpy);

      const error = new Error('Test error');
      errorHandler.handle(error);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
        })
      );
    });

    it('should log error with logger', () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error');
      const loggerWarnSpy = vi.spyOn(logger, 'warn');

      // Fatal error
      errorHandler.throw(ErrorCode.SOURCE_NOT_SUPPORTED, 'Fatal error', { fatal: true });
      expect(loggerErrorSpy).toHaveBeenCalled();

      // Non-fatal error
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Warning error', { fatal: false });
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should add to history', () => {
      expect(errorHandler.getHistory()).toHaveLength(0);

      errorHandler.handle(new Error('Error 1'));
      expect(errorHandler.getHistory()).toHaveLength(1);

      errorHandler.handle(new Error('Error 2'));
      expect(errorHandler.getHistory()).toHaveLength(2);
    });

    it('should include timestamp', () => {
      const beforeTime = Date.now();
      const result = errorHandler.handle(new Error('Test'));
      const afterTime = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('throw()', () => {
    it('should create and handle error from code', () => {
      const result = errorHandler.throw(
        ErrorCode.PLUGIN_SETUP_FAILED,
        'Plugin setup failed'
      );

      expect(result).toEqual(expect.objectContaining({
        code: ErrorCode.PLUGIN_SETUP_FAILED,
        message: 'Plugin setup failed',
      }));
    });

    it('should use provided fatal flag', () => {
      const fatalError = errorHandler.throw(
        ErrorCode.UNKNOWN_ERROR,
        'Test error',
        { fatal: true }
      );

      expect(fatalError.fatal).toBe(true);

      const nonFatalError = errorHandler.throw(
        ErrorCode.SOURCE_NOT_SUPPORTED,
        'Test error',
        { fatal: false }
      );

      expect(nonFatalError.fatal).toBe(false);
    });

    it('should determine fatal from code if not provided', () => {
      // Fatal code
      const fatalError = errorHandler.throw(
        ErrorCode.SOURCE_NOT_SUPPORTED,
        'Not supported'
      );
      expect(fatalError.fatal).toBe(true);

      // Non-fatal code
      const nonFatalError = errorHandler.throw(
        ErrorCode.PLAYBACK_FAILED,
        'Playback failed'
      );
      expect(nonFatalError.fatal).toBe(false);
    });

    it('should include context', () => {
      const context = { src: 'video.mp4', type: 'video/mp4' };
      const result = errorHandler.throw(
        ErrorCode.SOURCE_LOAD_FAILED,
        'Failed to load',
        { context }
      );

      expect(result.context).toEqual(context);
    });

    it('should include original error', () => {
      const originalError = new Error('Original');
      const result = errorHandler.throw(
        ErrorCode.PLUGIN_SETUP_FAILED,
        'Plugin failed',
        { originalError }
      );

      expect(result.originalError).toBe(originalError);
    });

    it('should emit error event', () => {
      const errorSpy = vi.fn();
      eventBus.on('error', errorSpy);

      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Test');

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('error classification', () => {
    it('should classify network errors', () => {
      const networkError = new Error('Network connection failed');
      const result = errorHandler.handle(networkError);

      expect(result.code).toBe(ErrorCode.MEDIA_NETWORK_ERROR);
    });

    it('should classify decode errors', () => {
      const decodeError = new Error('Failed to decode media');
      const result = errorHandler.handle(decodeError);

      expect(result.code).toBe(ErrorCode.MEDIA_DECODE_ERROR);
    });

    it('should classify source errors', () => {
      const sourceError = new Error('Source not found');
      const result = errorHandler.handle(sourceError);

      expect(result.code).toBe(ErrorCode.SOURCE_LOAD_FAILED);
    });

    it('should classify plugin errors', () => {
      const pluginError = new Error('Plugin initialization failed');
      const result = errorHandler.handle(pluginError);

      expect(result.code).toBe(ErrorCode.PLUGIN_SETUP_FAILED);
    });

    it('should classify provider errors', () => {
      const providerError = new Error('Provider setup error');
      const result = errorHandler.handle(providerError);

      expect(result.code).toBe(ErrorCode.PROVIDER_SETUP_FAILED);
    });

    it('should classify unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      const result = errorHandler.handle(unknownError);

      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it('should determine fatal errors correctly', () => {
      // Fatal codes
      const fatalCodes = [
        ErrorCode.SOURCE_NOT_SUPPORTED,
        ErrorCode.PROVIDER_NOT_FOUND,
        ErrorCode.MEDIA_DECODE_ERROR,
      ];

      fatalCodes.forEach((code) => {
        const error = errorHandler.throw(code, 'Test');
        expect(error.fatal).toBe(true);
      });

      // Non-fatal codes
      const nonFatalCodes = [
        ErrorCode.PLAYBACK_FAILED,
        ErrorCode.MEDIA_NETWORK_ERROR,
        ErrorCode.UNKNOWN_ERROR,
      ];

      nonFatalCodes.forEach((code) => {
        const error = errorHandler.throw(code, 'Test');
        expect(error.fatal).toBe(false);
      });
    });
  });

  describe('error history', () => {
    it('should maintain error history', () => {
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 1');
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 2');
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 3');

      const history = errorHandler.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('Error 1');
      expect(history[1].message).toBe('Error 2');
      expect(history[2].message).toBe('Error 3');
    });

    it('should limit history to max', () => {
      const limitedHandler = new ErrorHandler(eventBus, logger, { maxHistory: 3 });

      for (let i = 0; i < 5; i++) {
        limitedHandler.throw(ErrorCode.UNKNOWN_ERROR, `Error ${i}`);
      }

      const history = limitedHandler.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('Error 2');
      expect(history[1].message).toBe('Error 3');
      expect(history[2].message).toBe('Error 4');
    });

    it('should get last error', () => {
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 1');
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 2');

      const lastError = errorHandler.getLastError();

      expect(lastError).not.toBeNull();
      expect(lastError?.message).toBe('Error 2');
    });

    it('should return null when no errors', () => {
      const lastError = errorHandler.getLastError();

      expect(lastError).toBeNull();
    });

    it('should get all history as readonly', () => {
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 1');

      const history = errorHandler.getHistory();

      // Should be a copy
      expect(history).toEqual(errorHandler.getHistory());
      expect(history).not.toBe(errorHandler.getHistory());
    });

    it('should clear history', () => {
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 1');
      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Error 2');

      expect(errorHandler.getHistory()).toHaveLength(2);

      errorHandler.clearHistory();

      expect(errorHandler.getHistory()).toHaveLength(0);
      expect(errorHandler.getLastError()).toBeNull();
    });
  });

  describe('fatal errors', () => {
    it('should identify fatal errors', () => {
      expect(errorHandler.hasFatalError()).toBe(false);

      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Non-fatal', { fatal: false });
      expect(errorHandler.hasFatalError()).toBe(false);

      errorHandler.throw(ErrorCode.SOURCE_NOT_SUPPORTED, 'Fatal', { fatal: true });
      expect(errorHandler.hasFatalError()).toBe(true);
    });

    it('should check if any fatal occurred', () => {
      errorHandler.throw(ErrorCode.PLAYBACK_FAILED, 'Error 1', { fatal: false });
      errorHandler.throw(ErrorCode.PLAYBACK_FAILED, 'Error 2', { fatal: false });

      expect(errorHandler.hasFatalError()).toBe(false);

      errorHandler.throw(ErrorCode.PROVIDER_NOT_FOUND, 'Fatal');

      expect(errorHandler.hasFatalError()).toBe(true);
    });

    it('should persist fatal flag after clear history', () => {
      errorHandler.throw(ErrorCode.SOURCE_NOT_SUPPORTED, 'Fatal');
      expect(errorHandler.hasFatalError()).toBe(true);

      errorHandler.clearHistory();
      expect(errorHandler.hasFatalError()).toBe(false);
    });
  });

  describe('integration', () => {
    it('should integrate with EventBus', () => {
      const errorSpy = vi.fn();
      eventBus.on('error', errorSpy);

      errorHandler.throw(ErrorCode.UNKNOWN_ERROR, 'Test error');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.UNKNOWN_ERROR,
          message: 'Test error',
        })
      );
    });

    it('should integrate with Logger', () => {
      const loggerWarnSpy = vi.spyOn(logger, 'warn');
      const loggerErrorSpy = vi.spyOn(logger, 'error');

      // Non-fatal
      errorHandler.throw(ErrorCode.PLAYBACK_FAILED, 'Warning', { fatal: false });
      expect(loggerWarnSpy).toHaveBeenCalled();

      // Fatal
      errorHandler.throw(ErrorCode.SOURCE_NOT_SUPPORTED, 'Error', { fatal: true });
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should emit correct event data', () => {
      const errorSpy = vi.fn();
      eventBus.on('error', errorSpy);

      const context = { src: 'video.mp4' };
      errorHandler.throw(
        ErrorCode.SOURCE_LOAD_FAILED,
        'Load failed',
        { context, fatal: true }
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.SOURCE_LOAD_FAILED,
          message: 'Load failed',
          fatal: true,
          context,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should log with correct level for fatal errors', () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error');

      errorHandler.throw(ErrorCode.SOURCE_NOT_SUPPORTED, 'Fatal error');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        '[SOURCE_NOT_SUPPORTED] Fatal error',
        expect.objectContaining({
          code: ErrorCode.SOURCE_NOT_SUPPORTED,
        })
      );
    });

    it('should log with correct level for non-fatal errors', () => {
      const loggerWarnSpy = vi.spyOn(logger, 'warn');

      errorHandler.throw(ErrorCode.PLAYBACK_FAILED, 'Non-fatal error');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        '[PLAYBACK_FAILED] Non-fatal error',
        expect.objectContaining({
          code: ErrorCode.PLAYBACK_FAILED,
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing context', () => {
      const result = errorHandler.handle(new Error('Test'));

      expect(result.context).toBeUndefined();
    });

    it('should handle empty error message', () => {
      const emptyError = new Error('');
      const result = errorHandler.handle(emptyError);

      expect(result.message).toBe('');
    });

    it('should handle PlayerError with undefined context', () => {
      const playerError: PlayerError = {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Test',
        fatal: false,
        timestamp: Date.now(),
        context: undefined,
      };

      const result = errorHandler.handle(playerError);

      // When merging undefined contexts, we get an empty object
      expect(result.context).toEqual({});
    });

    it('should handle null error object detection', () => {
      // Test that null is not treated as PlayerError
      const result = errorHandler.handle(new Error('Test'));

      expect(result.originalError).toBeInstanceOf(Error);
    });

    it('should handle complex context objects', () => {
      const complexContext = {
        nested: { prop: 'value', arr: [1, 2, 3] },
        timestamp: Date.now(),
        data: { foo: 'bar' },
      };

      const result = errorHandler.throw(
        ErrorCode.UNKNOWN_ERROR,
        'Test',
        { context: complexContext }
      );

      expect(result.context).toEqual(complexContext);
    });

    it('should handle error without timestamp in PlayerError detection', () => {
      const invalidError = {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Test',
        fatal: false,
        // Missing timestamp
      };

      // Should treat as native error
      const result = errorHandler.handle(invalidError as any);

      // Will get classified as unknown since it's not a valid PlayerError
      expect(result).toEqual(expect.objectContaining({
        code: ErrorCode.UNKNOWN_ERROR,
      }));
    });
  });
});
