import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus, StateManager, type IPluginAPI } from '@scarlett-player/core';
import { createNativePlugin } from '../src/index';

describe('native element seeking', () => {
  let plugin: ReturnType<typeof createNativePlugin>;
  let state: StateManager;
  let bus: EventBus;
  let api: IPluginAPI;
  let video: HTMLVideoElement;

  beforeEach(async () => {
    state = new StateManager({ currentTime: 10 });
    bus = new EventBus();
    api = {
      pluginId: 'native-provider',
      container: document.createElement('div'),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getState: state.getValue.bind(state),
      setState: state.set.bind(state),
      defineState: state.define.bind(state),
      subscribeToState: state.subscribe.bind(state),
      on: bus.on.bind(bus),
      off: bus.off.bind(bus),
      emit: vi.fn(bus.emit.bind(bus)),
      getPlugin: vi.fn(),
      onDestroy: vi.fn(),
    };
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('loadedmetadata'));
    });
    plugin = createNativePlugin();
    await plugin.init(api);
    await plugin.loadSource('https://example.com/video.mp4');
    video = api.container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
  });

  afterEach(async () => {
    await plugin.destroy();
    state.destroy();
    vi.restoreAllMocks();
  });

  it('publishes the element seek target before notifying seeking subscribers', () => {
    const changes: unknown[] = [];
    state.subscribe(({ key, value }) => {
      if (key === 'currentTime' || key === 'seeking') {
        changes.push([key, value, state.getValue('currentTime')]);
      }
    });

    video.currentTime = 75;
    video.dispatchEvent(new Event('seeking'));

    expect(changes).toEqual([
      ['currentTime', 75, 75],
      ['seeking', true, 75],
    ]);
    expect(api.emit).not.toHaveBeenCalledWith('playback:seeking', expect.anything());
  });

  it('notifies one seeking transition for the UI/provider double write', () => {
    const changes = vi.fn();
    state.subscribe((event) => {
      if (event.key === 'seeking') changes(event);
    });

    video.currentTime = 75;
    bus.emit('playback:seeking', { time: 75 });
    expect(video.currentTime).toBe(75);
    video.dispatchEvent(new Event('seeking'));
    video.dispatchEvent(new Event('seeking'));

    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0]).toMatchObject({ previousValue: false, value: true });
    expect(api.emit).not.toHaveBeenCalledWith('playback:seeking', expect.anything());
  });
});
