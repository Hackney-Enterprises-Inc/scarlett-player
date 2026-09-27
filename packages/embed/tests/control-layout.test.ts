/**
 * Control layout tests - the video UI layout the embed hands over when a
 * plugin-registered control (share, clip, chapters) is on.
 */

import { describe, it, expect } from 'vitest';
import { buildControlLayout } from '../src/control-layout';

const HEAD = [
  'play',
  'skip-backward',
  'skip-forward',
  'volume',
  'time',
  'live-indicator',
  'bandwidth-indicator',
  'spacer',
];
const TAIL = ['settings', 'captions', 'chromecast', 'airplay', 'pip', 'fullscreen'];

describe('buildControlLayout', () => {
  it('should return undefined when nothing is on, so the UI keeps its default', () => {
    expect(buildControlLayout({})).toBeUndefined();
    expect(buildControlLayout({ share: false, chapters: false, clip: false })).toBeUndefined();
  });

  // Byte-for-byte the SHARE_CONTROL_LAYOUT the embed shipped up to 1.16.
  it('should keep share at the head of the right-hand group', () => {
    expect(buildControlLayout({ share: true })).toEqual([...HEAD, 'share', ...TAIL]);
  });

  it('should put chapters before the settings menu', () => {
    expect(buildControlLayout({ chapters: true })).toEqual([...HEAD, 'chapters', ...TAIL]);
  });

  it('should put clip before the settings menu', () => {
    expect(buildControlLayout({ clip: true })).toEqual([...HEAD, 'clip', ...TAIL]);
  });

  it('should order share, clip, chapters when all are on', () => {
    expect(buildControlLayout({ share: true, chapters: true, clip: true })).toEqual([
      ...HEAD,
      'share',
      'clip',
      'chapters',
      ...TAIL,
    ]);
  });

  it('should return a fresh array each call', () => {
    const a = buildControlLayout({ share: true });
    a?.push('mutated');
    expect(buildControlLayout({ share: true })).not.toContain('mutated');
  });
});
