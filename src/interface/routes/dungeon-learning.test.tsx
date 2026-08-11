import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-learning';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

const storageValues = new Map<string, string>();

describe('dungeon learning route', () => {
  beforeEach(() => {
    storageValues.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storageValues.clear(),
        getItem: (key: string) => storageValues.get(key) ?? null,
        setItem: (key: string, value: string) => storageValues.set(key, value),
      },
    });
  });

  it('does not expose contract fixtures as learning content', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/altar-of-fangs/learn']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '学习内容待审校' })).toBeInTheDocument();
    expect(screen.getByText(/开发契约 fixture/)).toBeInTheDocument();
    expect(screen.queryByText('剧毒咏唱')).not.toBeInTheDocument();
  });

  it('shows provenance links for a source-aware draft', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/learn']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('link', {
        name: 'Midnight Season 2 Mythic Dungeon Philosophy and Design Goals',
      }),
    ).toHaveAttribute(
      'href',
      'https://us.forums.blizzard.com/en/wow/t/midnight-season-2-mythic-dungeon-philosophy-and-design-goals/2320056/1',
    );
    expect(screen.getByText(/midnight-s2-ptr-12.1/)).toBeInTheDocument();
  });

  it('keeps the learning lesson connected to wave context without inventing forces', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/learn?mode=quick']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '这一节对应哪些波次' })).toBeInTheDocument();
    expect(screen.getByText('路线节点 P1')).toBeInTheDocument();
    expect(screen.getByText('6 个位置参考锚点')).toBeInTheDocument();
    expect(screen.getAllByText('forces 待核验')).toHaveLength(1);
    expect(screen.getByText('学习锚点')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开只读路线节点 →' })).toHaveAttribute(
      'href',
      '/dungeons/ruby-life-pools/route/rlp-phase1-learning-route',
    );
    expect(screen.getByText(/位置锚点不等于完整 Pull 或 forces 结论/)).toBeInTheDocument();
  });

  it('requires a confidence choice before revealing and exposes role state accessibly', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/learn?mode=quick']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '先选择把握程度' })).toBeDisabled();
    expect(screen.getByLabelText('学习状态')).toHaveTextContent('模糊 0');
    fireEvent.click(screen.getByRole('button', { name: '有点模糊' }));
    expect(screen.getByRole('button', { name: '有点模糊' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: '显示参考答案' }));
    expect(screen.getByText('参考答案')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '治疗' }));
    expect(screen.getByRole('button', { name: '治疗' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the share affordance readable instead of exposing raw query state', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/learn?mode=quick']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '分享本节学习链接' })).toHaveAttribute(
      'href',
      expect.stringContaining('/dungeons/ruby-life-pools/learn?mode=quick&situation='),
    );
    expect(screen.queryByText(/mode=quick&situation=/)).not.toBeInTheDocument();
  });

  it('restores the saved role when a shared URL does not specify one', () => {
    window.localStorage.setItem(
      'wowanalyzer:dungeon-learning:v1',
      JSON.stringify({ version: 1, byDungeon: {}, lastRole: 'healer' }),
    );
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/learn?mode=quick']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '治疗' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a dedicated weak review after a lesson is mastered', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/learn?mode=quick']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/learn" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '我能处理' }));
    fireEvent.click(screen.getByRole('button', { name: '显示参考答案' }));
    fireEvent.click(screen.getByRole('button', { name: '只复习薄弱项 →' }));

    expect(screen.getByText('薄弱项复习')).toBeInTheDocument();
    expect(screen.getByText(/这次只复习尚未稳定回忆的场景/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '回到全部章节 →' })).toBeInTheDocument();
  });
});
