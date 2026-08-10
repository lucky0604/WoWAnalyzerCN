import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeon-learning';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

describe('dungeon learning route', () => {
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
});
