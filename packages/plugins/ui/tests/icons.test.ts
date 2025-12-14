/**
 * Icons Tests
 */

import { describe, it, expect } from 'vitest';
import { icons } from '../src/icons';

describe('icons', () => {
  it('should export all required icons', () => {
    expect(icons.play).toBeDefined();
    expect(icons.pause).toBeDefined();
    expect(icons.replay).toBeDefined();
    expect(icons.volumeHigh).toBeDefined();
    expect(icons.volumeLow).toBeDefined();
    expect(icons.volumeMute).toBeDefined();
    expect(icons.fullscreen).toBeDefined();
    expect(icons.exitFullscreen).toBeDefined();
    expect(icons.pip).toBeDefined();
    expect(icons.settings).toBeDefined();
    expect(icons.chromecast).toBeDefined();
    expect(icons.chromecastConnected).toBeDefined();
    expect(icons.airplay).toBeDefined();
    expect(icons.checkmark).toBeDefined();
  });

  it('should be valid SVG strings', () => {
    for (const [name, svg] of Object.entries(icons)) {
      expect(svg).toMatch(/^<svg/);
      expect(svg).toMatch(/<\/svg>$/);
    }
  });

  it('should have viewBox attribute', () => {
    for (const svg of Object.values(icons)) {
      expect(svg).toContain('viewBox');
    }
  });
});
