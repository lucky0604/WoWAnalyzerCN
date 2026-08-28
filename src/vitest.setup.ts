import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { i18n } from '@lingui/core';
import { afterEach, beforeEach, expect, vi } from 'vitest';

expect.extend(matchers);

// 大多数组件用 t()/<Trans> 渲染；测试没有 I18nProvider。激活一个空 zh 目录后，
// t() 与 <Trans> 都回退到代码里的 message/默认文案（zh-first 页面即中文原文），
// 测试断言维持原样。需要真实目录的测试文件可自行 load + activate 覆盖。
i18n.load('zh', {});
i18n.activate('zh');

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
