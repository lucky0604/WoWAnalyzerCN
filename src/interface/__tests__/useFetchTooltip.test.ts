import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useRef: (initial: unknown) => {
      return { current: initial };
    },
  };
});

import { useFetchTooltip } from '../useFetchTooltip';
import { renderHook, act } from '@testing-library/react';

// We can't easily mock useRef reliably for this pattern, so test the
// fetch behavior at a higher level. Instead, let's test the integration
// through the component by mocking fetch.

describe('useFetchTooltip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a function', () => {
    const { result } = renderHook(() => useFetchTooltip());
    expect(typeof result.current).toBe('function');
  });

  it('caches successful responses', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ tooltip: '<div>Test Tooltip</div>' }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useFetchTooltip());

    await act(async () => {
      const content = await result.current({ type: 'spell', id: 123 });
      expect(content).toBe('<div>Test Tooltip</div>');
    });

    // Second call should use cache
    await act(async () => {
      const content = await result.current({ type: 'spell', id: 123 });
      expect(content).toBe('<div>Test Tooltip</div>');
    });

    // fetch should have been called only once (cached on second)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null on HTTP error', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useFetchTooltip());

    await act(async () => {
      const content = await result.current({ type: 'item', id: 999 });
      expect(content).toBeNull();
    });
  });

  it('returns null on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFetchTooltip());

    await act(async () => {
      const content = await result.current({ type: 'npc', id: 1 });
      expect(content).toBeNull();
    });
  });
});
