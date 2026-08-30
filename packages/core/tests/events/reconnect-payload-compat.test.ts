/**
 * Backward-compatibility contract for the reconnect event payloads.
 *
 * `error:reconnecting` gained `elapsedMs`/`windowMs`, and `error:recovered`
 * went from a `void` payload to an object. Both events are emitted by
 * PROVIDERS, so making either addition required would compile-break any
 * third-party provider plugin written against an earlier version - a
 * breaking change smuggled into a minor release.
 *
 * These assertions are compile-time. This file is listed in
 * tsconfig.typecheck.json for that reason: vitest transpiles without
 * type-checking, so without that entry every guarantee here would pass
 * vacuously.
 */

import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/events/event-bus';

describe('reconnect payload backward compatibility', () => {
  it('still accepts the pre-1.7 error:reconnecting payload', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('error:reconnecting', handler);
    // A third-party provider that predates elapsedMs/windowMs
    bus.emit('error:reconnecting', { attempt: 2, delayMs: 4000 });

    expect(handler).toHaveBeenCalledWith({ attempt: 2, delayMs: 4000 });
  });

  it('accepts the enriched error:reconnecting payload', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('error:reconnecting', handler);
    bus.emit('error:reconnecting', {
      attempt: 2,
      delayMs: 4000,
      elapsedMs: 6000,
      windowMs: 300000,
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ elapsedMs: 6000, windowMs: 300000 })
    );
  });

  it('still accepts a payload-free error:recovered', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('error:recovered', handler);
    // The shape every provider emitted before this event carried data
    bus.emit('error:recovered', undefined);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('accepts the enriched error:recovered payload and narrows to read it', () => {
    const bus = new EventBus();
    let recovered_on_attempt: number | undefined;

    bus.on('error:recovered', (payload) => {
      // The union with void is what keeps old providers compiling, so a
      // consumer that wants the fields narrows first
      if (payload) {
        recovered_on_attempt = payload.attempt;
      }
    });
    bus.emit('error:recovered', { attempt: 3, elapsedMs: 8200 });

    expect(recovered_on_attempt).toBe(3);
  });

  it('requires the full payload on the new error:reconnect-exhausted', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    // New in 1.7: no prior emitters exist, so every field is required and
    // a consumer never has to narrow
    bus.on('error:reconnect-exhausted', handler);
    bus.emit('error:reconnect-exhausted', {
      attempts: 5,
      elapsedMs: 301000,
      windowMs: 300000,
    });

    expect(handler).toHaveBeenCalledWith({
      attempts: 5,
      elapsedMs: 301000,
      windowMs: 300000,
    });
  });
});
