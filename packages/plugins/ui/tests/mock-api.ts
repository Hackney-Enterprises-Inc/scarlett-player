/**
 * Shared test-support type for this package's mock plugin APIs.
 *
 * Every suite builds its own `createMockApi()` with the state its control
 * cares about; this is the type they all annotate it with.
 */

import type { Mock } from 'vitest';
import type { IPluginAPI } from '@scarlett-player/core';

/**
 * A stubbed `IPluginAPI` whose methods are vitest mocks.
 *
 * Extending the real interface is what makes the stub usable without a cast at
 * each call site, so it cannot silently drift behind `IPluginAPI`.
 *
 * The members are typed bare `Mock` rather than `ReturnType<typeof vi.fn>`:
 * the generic signatures on `getState`/`setState` cannot be satisfied by a
 * mock created from a plain `(key: string) => unknown` implementation, while
 * bare `Mock` is `Mock<any, any>`, which accepts every shape and still exposes
 * `.mock`, `.mockReturnValue` and friends to the suites.
 */
export interface MockPluginAPI extends IPluginAPI {
  logger: { debug: Mock; info: Mock; warn: Mock; error: Mock };
  getState: Mock;
  setState: Mock;
  defineState: Mock;
  on: Mock;
  off: Mock;
  emit: Mock;
  getPlugin: Mock;
  onDestroy: Mock;
  subscribeToState: Mock;
}
