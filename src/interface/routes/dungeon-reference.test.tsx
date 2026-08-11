import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-reference';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

describe('dungeon coordinate reference route', () => {
  it('keeps a current S2 dungeon visible while its coordinate reference is pending', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/kings-rest/reference']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/reference" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '位置参考还在建设中' })).toBeInTheDocument();
    expect(screen.getByText(/可靠的地图\/坐标来源尚未接入/)).toBeInTheDocument();
    expect(screen.queryByText('开始学习')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回副本覆盖路线' })).toHaveAttribute(
      'href',
      '/dungeons',
    );
  });

  it('renders the current RLP coordinate reference without treating it as a learning release', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools/reference']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/reference" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '红玉新生法池' })).toBeInTheDocument();
    expect(screen.getByText('位置数量')).toBeInTheDocument();
    expect(screen.getByText('166')).toBeInTheDocument();
    expect(screen.getByText('正式攻略会在内容审校完成后单独开放。')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '开始学习' })).not.toBeInTheDocument();
  });
});
