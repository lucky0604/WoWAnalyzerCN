import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-legacy-reference';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

describe('legacy Threechest coordinate QA route', () => {
  it('renders a clearly isolated read-only coordinate snapshot', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/legacy/magi']}>
        <Routes>
          <Route path="/dungeons/legacy/:sourceKey" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '魔导师平台' })).toBeInTheDocument();
    expect(screen.getByText('DEV ONLY · LEGACY COORDINATE QA')).toBeInTheDocument();
    expect(screen.getByText('Threechest')).toBeInTheDocument();
    expect(screen.getByText('threechest-yx → normalized-v1')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('此页面不会把 legacy 数据映射到 Midnight S2。')).toBeInTheDocument();
  });

  it('does not guess unknown source keys', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/legacy/ruby-life-pools']}>
        <Routes>
          <Route path="/dungeons/legacy/:sourceKey" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '找不到这个 legacy 坐标快照' })).toBeInTheDocument();
    expect(screen.queryByText('Threechest')).not.toBeInTheDocument();
  });
});
