/**
 * ErrorHandler - Centralized error handling for Scarlett Player.
 *
 * Provides error classification, logging, history tracking, and event emission
 * for all player errors.
 *
 * Target size: ~0.4-0.6KB
 */

import type { EventBus } from './events/event-bus';
import type { Logger } from './logger';

/**
 * Player error codes.
 */
export enum ErrorCode {
  // Source loading errors
  SOURCE_NOT_SUPPORTED = 'SOURCE_NOT_SUPPORTED',
  SOURCE_LOAD_FAILED = 'SOURCE_LOAD_FAILED',

  // Provider errors
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_SETUP_FAILED = 'PROVIDER_SETUP_FAILED',

  // Plugin errors
  PLUGIN_SETUP_FAILED = 'PLUGIN_SETUP_FAILED',
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',

  // Playback errors
  PLAYBACK_FAILED = 'PLAYBACK_FAILED',
  MEDIA_DECODE_ERROR = 'MEDIA_DECODE_ERROR',
  MEDIA_NETWORK_ERROR = 'MEDIA_NETWORK_ERROR',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured player error.
 */
export interface PlayerError {
  /** Error code */
  code: ErrorCode;
  /** Error message */
  message: string;
  /** Whether error is fatal (unrecoverable) */
  fatal: boolean;
  /** Timestamp (milliseconds since epoch) */
  timestamp: number;
  /** Optional context (what was happening) */
  context?: Record<string, any>;
  /** Original error if wrapped */
  originalError?: Error;
}

/**
 * ErrorHandler options.
 */
export interface ErrorHandlerOptions {
  /** Maximum error history to keep (default: 10) */
  maxHistory?: number;
}

/**
 * ErrorHandler manages all player errors with classification and history.
 *
 * Features:
 * - Error classification (fatal vs recoverable)
 * - Error code mapping
 * - Error event emission
 * - Error history tracking
 * - Context capture
 * - Logger integration
 *
 * @example
 * ```ts
 * const errorHandler = new ErrorHandler(eventBus, logger);
 *
 * // Handle native error
 * try {
 *   // Some operation
 * } catch (error) {
 *   errorHandler.handle(error as Error, {
 *     operation: 'loadSource',
 *     src: 'video.mp4'
 *   });
 * }
 *
 * // Throw specific error
 * errorHandler.throw(
 *   ErrorCode.SOURCE_NOT_SUPPORTED,
 *   'MP4 files are not supported',
 *   { fatal: true, context: { src: 'video.mp4' } }
 * );
 *
 * // Check error history
 * const lastError = errorHandler.getLastError();
 * const hasFatal = errorHandler.hasFatalError();
 * ```
 */
export class ErrorHandler {
  /** Event bus for error emission */
  private eventBus: EventBus;

  /** Logger for error logging */
  private logger: Logger;

  /** Error history */
  private errors: PlayerError[] = [];

  /** Maximum history size */
  private maxHistory: number;

  /**
   * Create a new ErrorHandler.
   *
   * @param eventBus - Event bus for error emission
   * @param logger - Logger for error logging
   * @param options - Optional configuration
   */
  constructor(eventBus: EventBus, logger: Logger, options?: ErrorHandlerOptions) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.maxHistory = options?.maxHistory ?? 10;
  }

  /**
   * Handle an error.
   *
   * Normalizes, logs, emits, and tracks the error.
   *
   * @param error - Error to handle (native or PlayerError)
   * @param context - Optional context (what was happening)
   * @returns Normalized PlayerError
   *
   * @example
   * ```ts
   * try {
   *   loadVideo();
   * } catch (error) {
   *   errorHandler.handle(error as Error, { src: 'video.mp4' });
   * }
   * ```
   */
  handle(error: Error | PlayerError, context?: Record<string, any>): PlayerError {
    const playerError = this.normalizeError(error, context);

    // Add to history
    this.addToHistory(playerError);

    // Log the error
    this.logError(playerError);

    // Emit error event
    this.eventBus.emit('error', playerError);

    return playerError;
  }

  /**
   * Create and handle an error from code.
   *
   * @param code - Error code
   * @param message - Error message
   * @param options - Optional error options
   * @returns Created PlayerError
   *
   * @example
   * ```ts
   * errorHandler.throw(
   *   ErrorCode.SOURCE_NOT_SUPPORTED,
   *   'MP4 not supported',
   *   { fatal: true, context: { type: 'video/mp4' } }
   * );
   * ```
   */
  throw(
    code: ErrorCode,
    message: string,
    options?: {
      fatal?: boolean;
      context?: Record<string, any>;
      originalError?: Error;
    }
  ): PlayerError {
    const error: PlayerError = {
      code,
      message,
      fatal: options?.fatal ?? this.isFatalCode(code),
      timestamp: Date.now(),
      context: options?.context,
      originalError: options?.originalError,
    };

    return this.handle(error, options?.context);
  }

  /**
   * Get error history.
   *
   * @returns Readonly copy of error history
   *
   * @example
   * ```ts
   * const history = errorHandler.getHistory();
   * console.log(`${history.length} errors occurred`);
   * ```
   */
  getHistory(): readonly PlayerError[] {
    return [...this.errors];
  }

  /**
   * Get last error that occurred.
   *
   * @returns Last error or null if none
   *
   * @example
   * ```ts
   * const lastError = errorHandler.getLastError();
   * if (lastError?.fatal) {
   *   showErrorMessage(lastError.message);
   * }
   * ```
   */
  getLastError(): PlayerError | null {
    return this.errors[this.errors.length - 1] ?? null;
  }

  /**
   * Clear error history.
   *
   * @example
   * ```ts
   * errorHandler.clearHistory();
   * ```
   */
  clearHistory(): void {
    this.errors = [];
  }

  /**
   * Check if any fatal errors occurred.
   *
   * @returns True if any fatal error in history
   *
   * @example
   * ```ts
   * if (errorHandler.hasFatalError()) {
   *   player.reset();
   * }
   * ```
   */
  hasFatalError(): boolean {
    return this.errors.some((e) => e.fatal);
  }

  /**
   * Normalize error to PlayerError.
   * @private
   */
  private normalizeError(
    error: Error | PlayerError,
    context?: Record<string, any>
  ): PlayerError {
    if (this.isPlayerError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
      };
    }

    // Convert native Error to PlayerError
    return {
      code: this.getErrorCode(error),
      message: error.message,
      fatal: this.isFatal(error),
      timestamp: Date.now(),
      context,
      originalError: error,
    };
  }

  /**
   * Determine error code from native Error.
   * @private
   */
  private getErrorCode(error: Error): ErrorCode {
    const message = error.message.toLowerCase();

    if (message.includes('network')) {
      return ErrorCode.MEDIA_NETWORK_ERROR;
    }
    if (message.includes('decode')) {
      return ErrorCode.MEDIA_DECODE_ERROR;
    }
    if (message.includes('source')) {
      return ErrorCode.SOURCE_LOAD_FAILED;
    }
    if (message.includes('plugin')) {
      return ErrorCode.PLUGIN_SETUP_FAILED;
    }
    if (message.includes('provider')) {
      return ErrorCode.PROVIDER_SETUP_FAILED;
    }

    return ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Determine if error is fatal.
   * @private
   */
  private isFatal(error: Error): boolean {
    return this.isFatalCode(this.getErrorCode(error));
  }

  /**
   * Determine if error code is fatal.
   * @private
   */
  private isFatalCode(code: ErrorCode): boolean {
    const fatalCodes = [
      ErrorCode.SOURCE_NOT_SUPPORTED,
      ErrorCode.PROVIDER_NOT_FOUND,
      ErrorCode.MEDIA_DECODE_ERROR,
    ];
    return fatalCodes.includes(code);
  }

  /**
   * Type guard for PlayerError.
   * @private
   */
  private isPlayerError(error: any): error is PlayerError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'fatal' in error &&
      'timestamp' in error
    );
  }

  /**
   * Add error to history.
   * @private
   */
  private addToHistory(error: PlayerError): void {
    this.errors.push(error);

    // Keep only max history
    if (this.errors.length > this.maxHistory) {
      this.errors.shift();
    }
  }

  /**
   * Log error with appropriate level.
   * @private
   */
  private logError(error: PlayerError): void {
    const logMessage = `[${error.code}] ${error.message}`;

    if (error.fatal) {
      this.logger.error(logMessage, {
        code: error.code,
        context: error.context,
      });
    } else {
      this.logger.warn(logMessage, {
        code: error.code,
        context: error.context,
      });
    }
  }
}
