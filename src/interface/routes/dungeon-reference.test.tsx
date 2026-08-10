import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-reference';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

describe('dungeon coordinate reference route', () => {
  it('renders a coordinate-only view for a building dungeon without a learning link', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/magisters-terrace/reference']}>
        <Routes>
          <Route path="/dungeons/:dungeonId/reference" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '魔导师平台' })).toBeInTheDocument();
    expect(screen.getByText('地图背景未配置')).toBeInTheDocument();
    expect(screen.getByText('位置数量')).toBeInTheDocument();
    expect(screen.queryByText('开始学习')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /进入日志分析/ })).toHaveAttribute('href', '/');
  });
});
