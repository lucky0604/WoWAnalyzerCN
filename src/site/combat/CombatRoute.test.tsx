import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { CombatRoute } from './CombatRoute';
import { routeNodes } from '../demo/battle';

// jsdom 未实现 SVG 路径测量，统一打桩：总长 1000 的平面点
beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    value: () => 1000,
    configurable: true,
  });
  Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
    value: () => ({ x: 400, y: 150 }),
    configurable: true,
  });
});

describe('CombatRoute Focus Mode', () => {
  it('focusId 未命中任何节点时不亮段、不降噪（P4 回归）', () => {
    const { container } = render(<CombatRoute focusId="p4" />);
    const focusPath = container.querySelector<SVGPathElement>('.route-path-focus')!;
    expect(focusPath.style.opacity).toBe('0');
    expect(container.querySelectorAll('.route-dim')).toHaveLength(0);
    expect(container.querySelectorAll('.route-node.is-active')).toHaveLength(0);
  });

  it('focusId 命中节点时只亮对应区段并降噪其余', () => {
    const { container } = render(<CombatRoute focusId="p1" />);
    const focusPath = container.querySelector<SVGPathElement>('.route-path-focus')!;
    expect(focusPath.style.opacity).toBe('1');
    expect(focusPath.style.strokeDasharray).not.toBe('');
    expect(container.querySelectorAll('.route-dim')).toHaveLength(routeNodes.length - 1);
    expect(container.querySelectorAll('.route-node.is-active')).toHaveLength(1);
  });

  it('无 focusId 时渲染完整路线', () => {
    const { container } = render(<CombatRoute />);
    expect(container.querySelectorAll('.route-node')).toHaveLength(routeNodes.length);
    expect(container.querySelectorAll('.route-dim')).toHaveLength(0);
  });

  it('节点携带 kind 与图标框类名（对应样式钩子）', () => {
    const { container } = render(<CombatRoute />);
    expect(container.querySelector('.route-node--boss')).not.toBeNull();
    expect(container.querySelector('.route-node--start')).not.toBeNull();
    expect(container.querySelector('.route-node--end')).not.toBeNull();
    expect(container.querySelector('.node-icon-frame')).not.toBeNull();
  });
});
