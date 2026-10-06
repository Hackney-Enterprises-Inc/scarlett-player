/**
 * OS and device-type detection (SCAR-ANALYTICS-10).
 *
 * iOS user agents contain "like Mac OS X", and iPadOS 13+ Safari sends a
 * desktop Macintosh UA by default, so both must be told apart from macOS.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getOSInfo, getDeviceType, getBrowserInfo } from '../src/helpers';

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

/** In-app browsers (HEI-36): webviews inside social and Google apps. */
const IN_APP_UA = {
  instagramIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 614358270)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.119 Mobile Safari/537.36 Instagram 321.0.0.39.106 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 7; panther; panther; en_US; 571876379)',
  facebookIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.50.106;FBBV/625462424;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/627235493]',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/464.0.0.54.109;]',
  googleAppIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/320.0.640196277 Mobile/15E148 Safari/604.1',
  linkedInIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.6012',
  tiktokIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US ByteFullLocale/en isDarkMode/0 WKWebView/1 RevealType/Dialog BytedanceWebview/d8a21c6',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 trill_340005 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.0.5 ByteLocale/en ByteFullLocale/en Region/US AppId/1233 Spark/1.5.0.4-bugfix AppVersion/34.0.5 BytedanceWebview/d8a21c6',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
};

describe('getBrowserInfo in-app browsers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cases: Array<[string, string, { name: string; version?: string }]> = [
    ['Instagram on iOS', IN_APP_UA.instagramIOS, { name: 'Instagram', version: '337' }],
    ['Instagram on Android', IN_APP_UA.instagramAndroid, { name: 'Instagram', version: '321' }],
    ['Facebook on iOS', IN_APP_UA.facebookIOS, { name: 'Facebook', version: '468' }],
    ['Facebook on Android', IN_APP_UA.facebookAndroid, { name: 'Facebook', version: '464' }],
    ['the Google app on iOS', IN_APP_UA.googleAppIOS, { name: 'Google App', version: '320' }],
    ['LinkedIn on iOS', IN_APP_UA.linkedInIOS, { name: 'LinkedIn', version: '9' }],
    ['TikTok on iOS', IN_APP_UA.tiktokIOS, { name: 'TikTok', version: '34' }],
    ['TikTok on Android', IN_APP_UA.tiktokAndroid, { name: 'TikTok', version: '34' }],
  ];

  it.each(cases)('names %s', (_label, ua, expected) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
    expect(getBrowserInfo()).toEqual(expected);
  });

  it('reports Chrome on iOS separately from the Google search app', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.69 Mobile/15E148 Safari/604.1');
    expect(getBrowserInfo()).toEqual({ name: 'Chrome', version: '124' });
  });

  it('still reports desktop Chrome', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    expect(getBrowserInfo()).toEqual({ name: 'Chrome', version: '124' });
  });

  it('still reports plain Safari and Chrome', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA.iPhoneSafari17);
    expect(getBrowserInfo()).toEqual({ name: 'Safari', version: '17' });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IN_APP_UA.chromeAndroid);
    expect(getBrowserInfo()).toEqual({ name: 'Chrome', version: '124' });
  });
});
