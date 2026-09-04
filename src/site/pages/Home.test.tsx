import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));

import { Component as Home } from './Home';

// jsdom 未实现 SVG 路径测量（Home 内嵌 CombatRoute），统一打桩
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

afterEach(() => {
  vi.useRealTimers();
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/report-demo" element={<div>report-demo-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const input = () => screen.getByPlaceholderText('粘贴 Warcraft Logs 报告链接或代码');

describe('Home 控制台', () => {
  it('粘贴链接回车后进入分析态，按节奏推进并跳转演示页', () => {
    vi.useFakeTimers();
    renderHome();
    fireEvent.change(input(), { target: { value: 'https://www.warcraftlogs.com/reports/abc' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText('读取战报…')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(640);
    });
    expect(screen.getByText('识别副本与路线…')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2050 - 640);
    });
    expect(screen.getByText('report-demo-page')).toBeInTheDocument();
  });

  it('输入法合成中的回车不触发解析', () => {
    renderHome();
    fireEvent.change(input(), { target: { value: 'https://www.warcraftlogs.com/reports/abc' } });
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
    expect(screen.queryByText('读取战报…')).not.toBeInTheDocument();
  });

  it('空链接回车显示错误提示且不进入分析态', () => {
    renderHome();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.getByText('请粘贴有效的 Warcraft Logs 链接后再解析。')).toBeInTheDocument();
    expect(screen.queryByText('读取战报…')).not.toBeInTheDocument();
  });

  it('按 1–3 聚焦对应洞察卡，其余降噪', () => {
    renderHome();
    fireEvent.keyDown(window, { key: '2' });
    const cards = document.querySelectorAll('.insight-card');
    expect(cards).toHaveLength(3);
    expect(cards[1].className).toContain('is-focus');
    expect(cards[0].className).toContain('is-dimmed');
    expect(cards[2].className).toContain('is-dimmed');
  });

  it('非整数字键不崩溃也不聚焦', () => {
    renderHome();
    expect(() => fireEvent.keyDown(window, { key: '1.5' })).not.toThrow();
    expect(document.querySelectorAll('.insight-card.is-focus')).toHaveLength(0);
  });

  it('窗口级修饰键（meta/ctrl/alt）不劫持数字聚焦', () => {
    renderHome();
    for (const mods of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) {
      fireEvent.keyDown(window, { key: '2', ...mods });
      expect(document.querySelectorAll('.insight-card.is-focus')).toHaveLength(0);
    }
  });

  it('窗口级输入法合成中的数字键不聚焦，普通数字键仍生效', () => {
    renderHome();
    fireEvent.keyDown(window, { key: '2', isComposing: true });
    expect(document.querySelectorAll('.insight-card.is-focus')).toHaveLength(0);
    fireEvent.keyDown(window, { key: '2' });
    expect(document.querySelectorAll('.insight-card.is-focus')).toHaveLength(1);
  });
});
