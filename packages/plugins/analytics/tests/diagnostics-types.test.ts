/**
 * Structural parity tests: the local analytics types must be identical in
 * shape to the core diagnostics types.  These tests import the new core
 * (which is fine for CI); the compiled analytics package must not depend on
 * a core version newer than its peer range.
 */

import { describe, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  DiagnosticsPlaybackState,
  DiagnosticError,
  DiagnosticTimeRange,
} from '@scarlett-player/core';
import type {
  AnalyticsDiagnosticsPlaybackState,
  AnalyticsDiagnosticError,
  AnalyticsDiagnosticTimeRange,
} from '../src/types';

describe('diagnostics types parity', () => {
  it('AnalyticsDiagnosticTimeRange matches core DiagnosticTimeRange', () => {
    expectTypeOf<AnalyticsDiagnosticTimeRange>().toEqualTypeOf<DiagnosticTimeRange>();
  });

  it('AnalyticsDiagnosticsPlaybackState matches core DiagnosticsPlaybackState', () => {
    expectTypeOf<AnalyticsDiagnosticsPlaybackState>().toEqualTypeOf<DiagnosticsPlaybackState>();
  });

  it('AnalyticsDiagnosticError matches core DiagnosticError', () => {
    expectTypeOf<AnalyticsDiagnosticError>().toEqualTypeOf<DiagnosticError>();
  });
});
