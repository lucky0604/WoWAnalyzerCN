import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { i18n } from '@lingui/core';
import { afterEach, beforeEach, expect, vi } from 'vitest';

// Modules call t() at import time, so the locale must be active before any
// test module loads. No catalog is loaded here: the compiled zh catalog is
// gitignored and absent in CI, so t() falls back to the message: source.
i18n.activate('en');

expect.extend(matchers);

if (import.meta.env.CI) {
  // Hide all console output
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
} else {
  // vitest does not support canvas with threads on. we have vega configured to use svg in tests,
  // but it still tries to load the canvas lib, triggering a warning. this snipped suppresses that warning.
  const rawError = console.error;
  const canvasError =
    'Not implemented: HTMLCanvasElement.prototype.getContext (without installing the canvas npm package)';
  console.error = (message: unknown, ...args: unknown[]) => {
    if (
      (typeof message === 'string' && message.includes(canvasError)) ||
      (message instanceof Error && message.message.includes(canvasError))
    ) {
      return;
    }
    rawError(message, ...args);
  };
}

beforeEach(() => {
  vi.stubEnv('LOCALE', 'en-US');
});
afterEach(cleanup);

// make jest things think vitest is jest
(globalThis as Record<string, unknown>).jest = vi;
