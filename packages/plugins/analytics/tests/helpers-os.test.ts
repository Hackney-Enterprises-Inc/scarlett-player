/**
 * OS and device-type detection (SCAR-ANALYTICS-10).
 *
 * iOS user agents contain "like Mac OS X", and iPadOS 13+ Safari sends a
 * desktop Macintosh UA by default, so both must be told apart from macOS.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getOSInfo, getDeviceType } from '../src/helpers';

const UA = {
  iPhoneSafari17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iPhoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iPadSafari:
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  // iPadOS desktop mode and real macOS Safari send the same UA string.
  macintoshSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

function stubNavigator(userAgent: string, maxTouchPoints: number, platform: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  // jsdom has no maxTouchPoints, so define it on the instance for the test.
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
}

describe('getOSInfo / getDeviceType on Apple devices', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
  });

  it('reports iPhone Safari (iOS 17) as iOS on a mobile device', () => {
    stubNavigator(UA.iPhoneSafari17, 5, 'iPhone');
    expect(getOSInfo()).toEqual({ name: 'iOS', version: '17.5' });
    expect(getDeviceType()).toBe('mobile');
  });

  it('reports iPhone Chrome (CriOS) as iOS on a mobile device', () => {
    stubNavigator(UA.iPhoneChrome, 5, 'iPhone');
    expect(getOSInfo()).toEqual({ name: 'iOS', version: '17.5' });
    expect(getDeviceType()).toBe('mobile');
  });

  it('reports iPad Safari with an iPad UA as iOS on a tablet', () => {
    stubNavigator(UA.iPadSafari, 5, 'iPad');
    expect(getOSInfo()).toEqual({ name: 'iOS', version: '16.6' });
    expect(getDeviceType()).toBe('tablet');
  });

  it('reports iPadOS desktop-mode Safari (Macintosh UA, touch) as iOS on a tablet', () => {
    stubNavigator(UA.macintoshSafari, 5, 'MacIntel');
    expect(getOSInfo()).toEqual({ name: 'iOS', version: undefined });
    expect(getDeviceType()).toBe('tablet');
  });

  it('keeps real macOS Safari (no touch points) as macOS on a desktop', () => {
    stubNavigator(UA.macintoshSafari, 0, 'MacIntel');
    expect(getOSInfo()).toEqual({ name: 'macOS', version: '10.15' });
    expect(getDeviceType()).toBe('desktop');
  });
});
