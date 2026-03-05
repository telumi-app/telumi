// @ts-nocheck
/* eslint-disable */
/**
 * Selective polyfills for Smart TV / legacy Chromium (56+) compatibility.
 *
 * Next.js SWC handles syntax down-levelling (optional chaining, etc.)
 * but does NOT polyfill missing runtime APIs.  We add only what the
 * player code-path actually needs.
 */

/* ---------- queueMicrotask (Chrome 71+) ---------------------- */
if (typeof globalThis.queueMicrotask !== 'function') {
  globalThis.queueMicrotask = (cb: VoidFunction) => {
    Promise.resolve().then(cb).catch((e) =>
      setTimeout(() => {
        throw e;
      }, 0),
    );
  };
}

/* ---------- globalThis (Chrome 71+) -------------------------- */
if (typeof globalThis === 'undefined') {
  (function (this: typeof globalThis) { (this as Record<string, unknown>).globalThis = this; })();
}

/* ---------- AbortController (Chrome 66+) --------------------- */
if (typeof globalThis.AbortController === 'undefined') {
  class AbortSignalShim extends EventTarget {
    aborted = false;
    reason: unknown = undefined;
    onabort: ((this: AbortSignal, ev: Event) => void) | null = null;

    throwIfAborted() {
      if (this.aborted) throw this.reason;
    }
  }

  class AbortControllerShim {
    signal = new AbortSignalShim() as unknown as AbortSignal;

    abort(reason?: unknown) {
      const sig = this.signal as unknown as AbortSignalShim;
      if (sig.aborted) return;
      sig.aborted = true;
      sig.reason = reason ?? new DOMException('The operation was aborted.', 'AbortError');
      sig.dispatchEvent(new Event('abort'));
    }
  }

  globalThis.AbortController = AbortControllerShim as unknown as typeof AbortController;
}

/* ---------- Array.prototype.flat / flatMap (Chrome 69+) ------ */
if (!Array.prototype.flat) {
  (Array.prototype as Record<string, unknown>).flat = function flat(this: unknown[], depth = 1): unknown[] {
    const arr = this;
    return depth > 0
      ? arr.reduce<unknown[]>(
          (acc, val) =>
            acc.concat(Array.isArray(val) ? (val as unknown[]).flat(depth - 1) : val),
          [],
        )
      : arr.slice();
  };
}

if (!Array.prototype.flatMap) {
  (Array.prototype as Record<string, unknown>).flatMap = function flatMap<U>(
    this: unknown[],
    callback: (value: unknown, index: number, array: unknown[]) => U | readonly U[],
    thisArg?: unknown,
  ) {
    return this.map(callback, thisArg).flat(1);
  };
}

/* ---------- Object.fromEntries (Chrome 73+) ------------------ */
if (!Object.fromEntries) {
  Object.fromEntries = function fromEntries(iterable: Iterable<[string, unknown]>) {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of iterable) {
      obj[key] = value;
    }
    return obj;
  };
}

/* ---------- String.prototype.replaceAll (Chrome 85+) --------- */
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function replaceAll(
    search: string | RegExp,
    replacement: string,
  ) {
    if (search instanceof RegExp) {
      if (!search.global) {
        throw new TypeError('String.prototype.replaceAll called with a non-global RegExp');
      }
      return this.replace(search, replacement);
    }
    return this.split(search).join(replacement);
  } as typeof String.prototype.replaceAll;
}

export {};
