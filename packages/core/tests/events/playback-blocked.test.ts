import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/events/event-bus';
import type { PlayerEventMap } from '../../src/types/events';

describe('playback:blocked event contract', () => {
  it('delivers the typed reason and rejection name', () => {
    const bus = new EventBus();
    const listener = vi.fn<(payload: PlayerEventMap['playback:blocked']) => void>();
    bus.on('playback:blocked', listener);
    bus.emit('playback:blocked', { reason: 'autoplay', name: 'NotAllowedError' });
    bus.emit('playback:blocked', { reason: 'autoplay' });
    expect(listener).toHaveBeenNthCalledWith(1, { reason: 'autoplay', name: 'NotAllowedError' });
    expect(listener).toHaveBeenNthCalledWith(2, { reason: 'autoplay' });
  });

  it('is never emitted by playback:play alone', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.on('playback:blocked', listener);
    bus.emit('playback:play', undefined);
    expect(listener).not.toHaveBeenCalled();
  });
});
