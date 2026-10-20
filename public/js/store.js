/**
 * Per-browser persistence for the last plan, ticked tasks and actual spend.
 * Storage can be unavailable (private mode, blocked cookies), so every access
 * is guarded and the app keeps working in memory.
 */

const KEY = 'utsav-ai:v1';

/**
 * @typedef {{ plan: any | null, done: Record<string, boolean>, actuals: Record<string, number> }} SavedState
 */

/** @returns {SavedState} */
export function loadState() {
  const empty = { plan: null, done: {}, actuals: {} };
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      plan: parsed.plan ?? null,
      done: parsed.done && typeof parsed.done === 'object' ? parsed.done : {},
      actuals: parsed.actuals && typeof parsed.actuals === 'object' ? parsed.actuals : {},
    };
  } catch {
    return empty;
  }
}

/** @param {SavedState} state */
export function saveState(state) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled: keep working in memory.
  }
}
