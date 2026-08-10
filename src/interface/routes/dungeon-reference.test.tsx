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
});
