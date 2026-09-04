import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Playback } from './Playback';

function renderPlayback(progress = 0.472, onSeek?: (p: number) => void) {
  return render(<Playback current="14:57" duration="31:42" progress={progress} onSeek={onSeek} />);
}

const scrub = () => screen.getByRole('slider', { name: '回放进度' });

describe('Playback 键盘 seek', () => {
  it('ArrowRight 前进 0.02 并阻止默认滚动', () => {
    const onSeek = vi.fn();
    renderPlayback(0.472, onSeek);
    const pd = vi.spyOn(Event.prototype, 'preventDefault');
    fireEvent.keyDown(scrub(), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(0.492, 6));
    expect(pd).toHaveBeenCalled();
  });

  it('ArrowLeft 后退 0.02', () => {
    const onSeek = vi.fn();
    renderPlayback(0.472, onSeek);
    fireEvent.keyDown(scrub(), { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(0.452, 6));
  });

  it('Home 归零、End 拉满', () => {
    const onSeek = vi.fn();
    renderPlayback(0.472, onSeek);
    fireEvent.keyDown(scrub(), { key: 'Home' });
    fireEvent.keyDown(scrub(), { key: 'End' });
    expect(onSeek).toHaveBeenNthCalledWith(1, 0);
    expect(onSeek).toHaveBeenNthCalledWith(2, 1);
  });

  it('clamp: 距两端不足 0.02 时收敛到 0 / 1', () => {
    const onSeekLow = vi.fn();
    const low = renderPlayback(0.01, onSeekLow);
    fireEvent.keyDown(low.container.querySelector('.playback-scrub')!, { key: 'ArrowLeft' });
    expect(onSeekLow).toHaveBeenCalledWith(0);
    low.unmount();

    const onSeekHigh = vi.fn();
    const high = renderPlayback(0.99, onSeekHigh);
    fireEvent.keyDown(high.container.querySelector('.playback-scrub')!, { key: 'ArrowRight' });
    expect(onSeekHigh).toHaveBeenCalledWith(1);
  });

  it('未传 onSeek 时按键不抛错', () => {
    renderPlayback();
    expect(() => fireEvent.keyDown(scrub(), { key: 'End' })).not.toThrow();
  });
});

describe('Playback 指针 seek', () => {
  it('jsdom 零宽矩形下点击不产生 NaN seek（零宽守卫）', () => {
    const onSeek = vi.fn();
    renderPlayback(0.472, onSeek);
    fireEvent.click(scrub(), { clientX: 40 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('有宽度时按 clientX 相对位置 seek', () => {
    const onSeek = vi.fn();
    const { container } = renderPlayback(0.472, onSeek);
    const el = container.querySelector('.playback-scrub')!;
    el.getBoundingClientRect = () =>
      ({
        left: 10,
        width: 200,
        top: 0,
        right: 210,
        bottom: 20,
        height: 20,
        x: 10,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.click(el, { clientX: 110 });
    expect(onSeek).toHaveBeenCalledWith(0.5);
  });
});

describe('Playback 其他', () => {
  it('scrubber 可聚焦（tabIndex=0）', () => {
    renderPlayback();
    expect(scrub().tabIndex).toBe(0);
  });

  it('速度按钮切换 is-on 高亮', () => {
    const { container } = renderPlayback();
    const speeds = container.querySelectorAll('.playback-speed');
    expect(speeds[0].className).toContain('is-on');
    fireEvent.click(speeds[2]);
    expect(speeds[2].className).toContain('is-on');
    expect(speeds[0].className).not.toContain('is-on');
  });
});
