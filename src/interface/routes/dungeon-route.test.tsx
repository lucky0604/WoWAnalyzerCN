import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-route';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

describe('read-only dungeon route page', () => {
  it('keeps route intent, steps and learning links in one read-only view', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/route/rlp-phase1-learning-route']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/route/:routeId" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: '学习路线：先练动作，再理解空间' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '只读步骤' })).toBeInTheDocument();
    expect(
      screen.getAllByText('先练“走位 + 打断”的共同语言；spawn 和 forces 待空间快照接入。'),
    ).toHaveLength(2);
    expect(screen.getByRole('link', { name: /入口施法组/ })).toHaveAttribute(
      'href',
      '/dungeons/ruby-life-pools/learn?mode=full&situation=rlp-situation-first-caster-pack',
    );

    fireEvent.click(screen.getByRole('button', { name: /梅莉杜莎转阶段/ }));
    expect(screen.getAllByText('把落点集中、预留通道和离开拉扯练成连续动作。')).toHaveLength(2);
  });
});
