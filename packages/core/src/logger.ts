/**
 * Logger - Structured logging system for Scarlett Player.
 *
 * Provides leveled logging with plugin-scoped child loggers,
 * structured metadata, and custom log handlers.
 *
 * Target size: ~0.3-0.5KB
 */

/**
 * Log severity levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry.
 */
export interface LogEntry {
  /** Severity level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp (milliseconds since epoch) */
  timestamp: number;
  /** Optional scope (e.g., plugin name) */
  scope?: string;
  /** Optional structured metadata */
  metadata?: Record<string, any>;
}

/**
 * Custom log handler function.
 */
export type LogHandler = (entry: LogEntry) => void;

/**
 * Logger options.
 */
export interface LoggerOptions {
  /** Minimum log level to output (default: 'warn') */
  level?: LogLevel;
  /** Logger scope (e.g., plugin name) */
  scope?: string;
  /** Enable/disable logging (default: true) */
  enabled?: boolean;
  /** Custom log handlers (default: console handler) */
  handlers?: LogHandler[];
}

/**
 * Log level ordering for threshold comparison.
 */
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Default console handler for log entries.
 * @private
 */
const defaultConsoleHandler: LogHandler = (entry) => {
  const prefix = entry.scope ? `[${entry.scope}]` : '[ScarlettPlayer]';
  const message = `${prefix} ${entry.message}`;
  const metadata = entry.metadata ?? '';

  switch (entry.level) {
    case 'debug':
      console.debug(message, metadata);
      break;
    case 'info':
      console.info(message, metadata);
      break;
    case 'warn':
      console.warn(message, metadata);
      break;
    case 'error':
      console.error(message, metadata);
      break;
  }
};

/**
 * Logger provides structured, leveled logging with plugin scoping.
 *
 * Features:
 * - Log levels: debug, info, warn, error
 * - Plugin-scoped child loggers
 * - Structured metadata support
 * - Custom log handlers
 * - Dynamic level and enable/disable
 *
 * @example
 * ```ts
 * // Main player logger
 * const logger = new Logger({ level: 'warn' });
 * logger.info('Player initialized');
 *
 * // Plugin logger (scoped)
 * const pluginLogger = logger.child('hls-plugin');
 * pluginLogger.debug('Manifest loaded', { url: 'video.m3u8' });
 * // Output: [ScarlettPlayer:hls-plugin] Manifest loaded
 *
 * // Custom handler for analytics
 * logger.addHandler((entry) => {
 *   if (entry.level === 'error') {
 *     sendToAnalytics(entry);
 *   }
 * });
 *
 * // Change level dynamically
 * if (import.meta.env.DEV) {
 *   logger.setLevel('debug');
 * }
 * ```
 */
export class Logger {
  /** Minimum log level threshold */
  private level: LogLevel;

  /** Logger scope (e.g., plugin name) */
  private scope?: string;

  /** Log handlers */
  private handlers: LogHandler[];

  /** Enable/disable logging */
  private enabled: boolean;

  /**
   * Create a new Logger.
   *
   * @param options - Logger configuration
   */
  constructor(options?: LoggerOptions) {
    this.level = options?.level ?? 'warn';
    this.scope = options?.scope;
    this.enabled = options?.enabled ?? true;
    this.handlers = options?.handlers ?? [defaultConsoleHandler];
  }

  /**
   * Create a child logger with a scope.
   *
   * Child loggers inherit parent settings and chain scopes.
   *
   * @param scope - Child logger scope
   * @returns New child logger
   *
   * @example
   * ```ts
   * const logger = new Logger();
   * const hlsLogger = logger.child('hls-plugin');
   * hlsLogger.info('Loading manifest');
   * // Output: [ScarlettPlayer:hls-plugin] Loading manifest
   * ```
   */
  child(scope: string): Logger {
    return new Logger({
      level: this.level,
      scope: this.scope ? `${this.scope}:${scope}` : scope,
      enabled: this.enabled,
      handlers: this.handlers,
    });
  }

  /**
   * Log a debug message.
   *
   * @param message - Log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```ts
   * logger.debug('Request sent', { url: '/api/video' });
   * ```
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log an info message.
   *
   * @param message - Log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```ts
   * logger.info('Player ready');
   * ```
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log a warning message.
   *
   * @param message - Log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```ts
   * logger.warn('Low buffer', { buffered: 2.5 });
   * ```
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log an error message.
   *
   * @param message - Log message
   * @param metadata - Optional structured metadata
   *
   * @example
   * ```ts
   * logger.error('Playback failed', { code: 'MEDIA_ERR_DECODE' });
   * ```
   */
  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  /**
   * Set the minimum log level threshold.
   *
   * @param level - New log level
   *
   * @example
   * ```ts
   * logger.setLevel('debug'); // Show all logs
   * logger.setLevel('error'); // Show only errors
   * ```
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Enable or disable logging.
   *
   * @param enabled - Enable flag
   *
   * @example
   * ```ts
   * logger.setEnabled(false); // Disable all logging
   * ```
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Add a custom log handler.
   *
   * @param handler - Log handler function
   *
   * @example
   * ```ts
   * logger.addHandler((entry) => {
   *   if (entry.level === 'error') {
   *     sendToAnalytics(entry);
   *   }
   * });
   * ```
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a custom log handler.
   *
   * @param handler - Log handler function to remove
   *
   * @example
   * ```ts
   * logger.removeHandler(myHandler);
   * ```
   */
  removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Core logging implementation.
   * @private
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled || !this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      scope: this.scope,
      metadata,
    };

    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch (error) {
        // Don't let handler errors break logging
        console.error('[Logger] Handler error:', error);
      }
    }
  }

  /**
   * Check if a log level should be output.
   * @private
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.level);
  }
}

/**
 * Create a new logger instance.
 *
 * Convenience factory function.
 *
 * @param scope - Optional logger scope
 * @returns New Logger instance
 *
 * @example
 * ```ts
 * const logger = createLogger('my-plugin');
 * logger.info('Plugin initialized');
 * ```
 */
export function createLogger(scope?: string): Logger {
  return new Logger({ scope });
}
