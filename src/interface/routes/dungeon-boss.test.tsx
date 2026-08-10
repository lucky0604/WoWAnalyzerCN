import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-boss';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

describe('dungeon boss learning page', () => {
  it('connects a boss to situations, mechanics and role advice without edit controls', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/boss/rlp-phase1-boss-melidrussa']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/boss/:bossId" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '梅莉杜莎·寒妆' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '阶段与学习场景' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '冰雹炸弹' })).toBeInTheDocument();
    expect(screen.getByText(/位置 \/ spawn 快照待接入/)).toBeInTheDocument();
    expect(screen.getByText(/没有通过 WCL 或实测样本归因/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导入|保存|编辑/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '治疗' }));
    expect(screen.getByText('在爆炸前确认队伍仍有可用的安全区。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入完整学习 →' })).toHaveAttribute(
      'href',
      '/dungeons/ruby-life-pools/learn?mode=full&situation=rlp-situation-melidrussa-boss',
    );
  });
});
