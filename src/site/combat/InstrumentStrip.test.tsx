import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('site/demo/battle', () => ({
  instruments: [
    { label: '单点', value: '1', spark: [5] },
    { label: '多点', value: '2', spark: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { label: '金币', value: '3', tone: 'gold', sub: '环比 +4%' },
    { label: '良好', value: '4', tone: 'good', sub: '环比 +1%' },
  ],
  dossiers: [],
  insights: [],
}));

import { InstrumentStrip } from './InstrumentStrip';

describe('InstrumentStrip spark 守卫', () => {
  it('单点数据渲染空 polyline（除零守卫），多点正常展开', () => {
    const { container } = render(<InstrumentStrip />);
    const lines = container.querySelectorAll('.instrument-spark polyline');
    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute('points')).toBe('');
    expect(lines[1].getAttribute('points')).not.toBe('');
  });

  it('tone 类名与 sub 文案回退', () => {
    const { container } = render(<InstrumentStrip />);
    expect(container.querySelector('.instrument-value--gold')).not.toBeNull();
    expect(container.querySelector('.instrument-value--good')).not.toBeNull();
    expect(container.textContent).toContain('环比 +4%');
  });
});
