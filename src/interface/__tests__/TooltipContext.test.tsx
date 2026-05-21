import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { TooltipProvider, useTooltipContext } from '../TooltipContext';

describe('TooltipContext', () => {
  describe('useTooltipContext', () => {
    it('throws when used outside TooltipProvider', () => {
      expect(() => renderHook(() => useTooltipContext()).result.current).toThrow(
        'useTooltipContext must be used within a TooltipProvider',
      );
    });

    it('returns context when used inside TooltipProvider', () => {
      const { result } = renderHook(() => useTooltipContext(), {
        wrapper: ({ children }) => <TooltipProvider>{children}</TooltipProvider>,
      });
      expect(result.current).toBeDefined();
      expect(typeof result.current.showTooltip).toBe('function');
      expect(typeof result.current.hideTooltip).toBe('function');
    });
  });
});
