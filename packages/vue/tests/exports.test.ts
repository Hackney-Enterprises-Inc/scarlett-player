/**
 * Test that all exports from @scarlett-player/vue are correctly exported
 */
import { describe, it, expect } from 'vitest';

describe('@scarlett-player/vue exports', () => {
  it('exports ScarlettPlayerComponent', async () => {
    const module = await import('../src/index');
    expect(module.ScarlettPlayerComponent).toBeDefined();
  });

  it('exports default component', async () => {
    const module = await import('../src/index');
    expect(module.default).toBeDefined();
    expect(module.default).toBe(module.ScarlettPlayerComponent);
  });

  it('exports useScarlettPlayer composable', async () => {
    const module = await import('../src/index');
    expect(module.useScarlettPlayer).toBeDefined();
    expect(typeof module.useScarlettPlayer).toBe('function');
  });

  it('exports ScarlettPlayerPlugin', async () => {
    const module = await import('../src/index');
    expect(module.ScarlettPlayerPlugin).toBeDefined();
    expect(module.ScarlettPlayerPlugin.install).toBeDefined();
    expect(typeof module.ScarlettPlayerPlugin.install).toBe('function');
  });
});
