/**
 * Type-level tests (plan task 1.4): the clips package's declaration-merging
 * block from .docs/plans/scarlett-clips-plugin.md compiles, and every merged
 * key lands with the plan's exact shape.
 *
 * This file is never executed. Vitest's default include pattern does not match
 * `*.test-d.ts`; `pnpm typecheck` (tsc over tsconfig.typecheck.json, whose
 * include glob covers the tests directory) is the assertion engine. A mismatch
 * is a compile error, and each `@ts-expect-error` proves the *negative* half -
 * that wrong shapes are rejected, not just unchecked.
 */

import type { StateStore, StateKey, StateValue, PlayerEventMap, EventName, EventPayload } from '@scarlett-player/core';
import type { ClipRange } from '../src/types';

// The plan's merging block, verbatim. Later moves into src/index.ts (task 2.3);
// duplicated here so the type guarantees are pinned in Group 1's tests.
declare module '@scarlett-player/core' {
  interface StateStore {
    clipSelection: { start: number; end: number } | null;
    clipOpen: boolean;
    clipTitle: string;   // '' when empty; lives in state so headless hosts and the overlay agree
  }
  interface PlayerEventMap {
    'clip:opened': { start: number; end: number };
    'clip:changed': { start: number; end: number; reason: 'user' | 'clamp' };      // Phase 2 adds 'live'
    'clip:created': { range: ClipRange; result: unknown };  // result = onCreate's value or the endpoint's parsed JSON
    'clip:cancelled': { reason: 'user' | 'source-change' | 'destroy' };            // Phase 2 adds 'live-expired'
    'clip:error': { error: Error };
  }
}

/** Compile-time assertion: fails unless T is exactly `true`. */
type Assert<T extends true> = T;

/** Exact type equality (invariant), not mutual assignability. */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

// === StateStore: all three keys exist and merge with exact shapes ===

type _ClipSelectionKey = Assert<'clipSelection' extends StateKey ? true : false>;
type _ClipOpenKey = Assert<'clipOpen' extends StateKey ? true : false>;
type _ClipTitleKey = Assert<'clipTitle' extends StateKey ? true : false>;

type _ClipSelectionShape = Assert<Equals<StateStore['clipSelection'], { start: number; end: number } | null>>;
type _ClipOpenShape = Assert<Equals<StateStore['clipOpen'], boolean>>;
type _ClipTitleShape = Assert<Equals<StateStore['clipTitle'], string>>;

// The merged keys flow through the StateValue<K> helper the plugin API uses,
// which is how api.defineState / getState / setState type them at the call site.
type _SelectionValue = Assert<Equals<StateValue<'clipSelection'>, { start: number; end: number } | null>>;
type _OpenValue = Assert<Equals<StateValue<'clipOpen'>, boolean>>;
type _TitleValue = Assert<Equals<StateValue<'clipTitle'>, string>>;

// Assignability spot-checks (runtime-shaped, but only ever compiled).
declare const selection: StateStore['clipSelection'];
type _SelectionNullable = Assert<Equals<typeof selection, { start: number; end: number } | null>>;

// @ts-expect-error - clipOpen is boolean, not 'true'-as-string
const _badClipOpen: StateStore['clipOpen'] = 'true';
// @ts-expect-error - clipTitle is '' when empty, not null
const _badClipTitle: StateStore['clipTitle'] = null;
// @ts-expect-error - a selection has start/end, not startTime/endTime (that's ClipRange)
const _badClipSelection: StateStore['clipSelection'] = { startTime: 1, endTime: 2 };

// === PlayerEventMap: all five events exist with exact payloads ===

type _OpenedName = Assert<'clip:opened' extends EventName ? true : false>;
type _ChangedName = Assert<'clip:changed' extends EventName ? true : false>;
type _CreatedName = Assert<'clip:created' extends EventName ? true : false>;
type _CancelledName = Assert<'clip:cancelled' extends EventName ? true : false>;
type _ErrorName = Assert<'clip:error' extends EventName ? true : false>;

type _OpenedPayload = Assert<Equals<EventPayload<'clip:opened'>, { start: number; end: number }>>;
type _ChangedPayload = Assert<
  Equals<EventPayload<'clip:changed'>, { start: number; end: number; reason: 'user' | 'clamp' }>
>;
type _CreatedPayload = Assert<Equals<EventPayload<'clip:created'>, { range: ClipRange; result: unknown }>>;
type _CancelledPayload = Assert<
  Equals<EventPayload<'clip:cancelled'>, { reason: 'user' | 'source-change' | 'destroy' }>
>;
type _ErrorPayload = Assert<Equals<EventPayload<'clip:error'>, { error: Error }>>;

// @ts-expect-error - 'live' is a Phase 2 reason and must not compile today
const _badChangedReason: PlayerEventMap['clip:changed'] = { start: 0, end: 1, reason: 'live' };
// @ts-expect-error - 'live-expired' is a Phase 2 cancel reason and must not compile today
const _badCancelReason: PlayerEventMap['clip:cancelled'] = { reason: 'live-expired' };
// @ts-expect-error - clip:created carries the full ClipRange, not a bare selection
const _badCreatedRange: PlayerEventMap['clip:created'] = { range: { start: 0, end: 1 }, result: null };

// === ClipRange: the payload fields the merged events reference ===

type _RangeCapturedAtString = Assert<Equals<ClipRange['capturedAt'], string>>;
type _RangeTitleNullable = Assert<Equals<ClipRange['title'], string | null>>;
// VOD wire fields stay null-typed so the contract does not change when live lands.
type _RangeSeekableNullable = Assert<Equals<ClipRange['seekableStart'], number | null>>;
type _RangeDatesNullable = Assert<Equals<ClipRange['startDate'], string | null>>;

// Referenced so `noUnusedLocals`-style tooling never mistakes the file for dead
// code; the assertions above are the substance and all disappear at compile time.
export type TypesTestD =
  | _ClipSelectionKey
  | _ClipOpenKey
  | _ClipTitleKey
  | _ClipSelectionShape
  | _ClipOpenShape
  | _ClipTitleShape
  | _SelectionValue
  | _OpenValue
  | _TitleValue
  | _SelectionNullable
  | _OpenedName
  | _ChangedName
  | _CreatedName
  | _CancelledName
  | _ErrorName
  | _OpenedPayload
  | _ChangedPayload
  | _CreatedPayload
  | _CancelledPayload
  | _ErrorPayload
  | _RangeCapturedAtString
  | _RangeTitleNullable
  | _RangeSeekableNullable
  | _RangeDatesNullable;

// Silence unused-var warnings on the negative-assertion consts below; they
// exist only so their @ts-expect-error lines compile.
export const _negativeAssertions: unknown[] = [
  _badClipOpen,
  _badClipTitle,
  _badClipSelection,
  _badChangedReason,
  _badCancelReason,
  _badCreatedRange,
];
