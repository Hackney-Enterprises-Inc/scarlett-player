/**
 * ErrorHandler recording and append/quota classification tests
 * (Phase 2 of fix/scarlett-error-absorption).
 *
 * record() must track history and log WITHOUT emitting an `error` event,
 * so advisory channels (media element errors already handled by a
 * provider's recovery path) never flip the player's error state.
 * Append/quota failures must classify to their own recoverable codes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, ErrorCode } from '../src/error-handler';
import { EventBus } from '../src/events/event-bus';
import { Logger } from '../src/logger';

describe('ErrorHandler.record()', () => {
  let errorHandler: ErrorHandler;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    errorHandler = new ErrorHandler(eventBus, new Logger({ level: 'debug' }));

    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('adds to history without emitting an error event', () => {
    const errorSpy = vi.fn();
    eventBus.on('error', errorSpy);

    const recorded = errorHandler.record(new Error('MEDIA_ELEMENT_ERROR: Empty src attribute'));

    expect(errorSpy).not.toHaveBeenCalled();
    expect(errorHandler.getHistory()).toHaveLength(1);
    expect(errorHandler.getLastError()).toEqual(recorded);
  });

  it('normalizes a native Error and merges context', () => {
    const recorded = errorHandler.record(new Error('some element error'), {
      channel: 'media:error',
    });

    expect(recorded.message).toBe('some element error');
    expect(recorded.context?.channel).toBe('media:error');
    expect(recorded.originalError).toBeInstanceOf(Error);
  });

  it('handle() still emits (record is the non-emitting variant)', () => {
    const errorSpy = vi.fn();
    eventBus.on('error', errorSpy);

    errorHandler.handle(new Error('boom'));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorHandler.getHistory()).toHaveLength(1);
  });
});

describe('append/quota error classification', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler(new EventBus(), new Logger({ level: 'debug' }));

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('classifies quota errors as MEDIA_BUFFER_FULL', () => {
    const error = errorHandler.record(
      new Error('QuotaExceededError: buffer append rejected')
    );
    expect(error.code).toBe(ErrorCode.MEDIA_BUFFER_FULL);
  });

  it('classifies detached ArrayBuffer errors as MEDIA_APPEND_ERROR', () => {
    // The exact production message from Sentry COMBATSPORTSNOW-PHP-2BR
    const error = errorHandler.record(
      new Error('Cannot perform Construct on a detached or out-of-bounds ArrayBuffer')
    );
    expect(error.code).toBe(ErrorCode.MEDIA_APPEND_ERROR);
  });

  it('classifies SourceBuffer append failures as MEDIA_APPEND_ERROR', () => {
    const error = errorHandler.record(
      new Error("Failed to execute 'appendBuffer' on 'SourceBuffer'")
    );
    expect(error.code).toBe(ErrorCode.MEDIA_APPEND_ERROR);
  });

  it('treats append/quota classes as recoverable, not fatal', () => {
    const append = errorHandler.record(new Error('appendBuffer failed'));
    const quota = errorHandler.record(new Error('quota exceeded'));

    expect(append.fatal).toBe(false);
    expect(quota.fatal).toBe(false);
  });

  it('still classifies network and decode errors as before', () => {
    expect(errorHandler.record(new Error('network request failed')).code).toBe(
      ErrorCode.MEDIA_NETWORK_ERROR
    );
    expect(errorHandler.record(new Error('failed to decode frame')).code).toBe(
      ErrorCode.MEDIA_DECODE_ERROR
    );
  });
});
