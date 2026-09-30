import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/events/event-bus';
import type { PlayerEventMap } from '../../src/types/events';

describe('media:segment event contract', () => {
  it('delivers typed segment measurements without manufacturing events', () => {
    const bus = new EventBus();
    const listener = vi.fn<(segment: PlayerEventMap['media:segment']) => void>();
    bus.on('media:segment', listener);

    expect(listener).not.toHaveBeenCalled();
    bus.emit('media:segment', { durationMs: 250, bytes: 1000, ok: true, kind: 'main' });
    expect(listener).toHaveBeenCalledWith({ durationMs: 250, bytes: 1000, ok: true, kind: 'main' });
  });

  it('allows subscribers on an older runtime that never emits this event', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    expect(() => bus.on('media:segment', listener)).not.toThrow();
    bus.emit('media:loaded', { src: 'video.mp4', type: 'video/mp4' });
    expect(listener).not.toHaveBeenCalled();
  });
});
