import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Component } from './dungeons';

vi.mock('interface/DocumentTitle', () => ({ default: () => null }));
vi.mock('interface/NavigationBar', () => ({
  default: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
}));

function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

describe('dungeon inspector query', () => {
  it('supports a keyboard-accessible reverse lookup from ability to caster context', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools']}>
        <Routes>
          <Route path="/dungeons/:dungeonId" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    const input = screen.getByRole('searchbox', { name: '搜索怪物、技能、Situation 或路线' });
    fireEvent.change(input, { target: { value: '冰霜护盾' } });

    const result = screen.getByRole('option', { name: /技能.*冰霜护盾/ });
    fireEvent.click(result);

    expect(
      screen.getByText('优先打断或使用魔法驱散处理护盾，再回到主要目标。'),
    ).toBeInTheDocument();
    expect(screen.getByText(/施法者：闪霜织寒者/)).toBeInTheDocument();
  });

  it('restores a floor from a deep link and keeps the pull focus disabled until spawns exist', () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools?floor=rlp-dragonheart-outpost']}>
        <Routes>
          <Route path="/dungeons/:dungeonId" element={<Component />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: /龙心岗哨/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '当前 Pull' })).toBeDisabled();
  });

  it('canonicalizes an unknown floor deep link instead of leaving a broken state', async () => {
    render(
      <MemoryRouter initialEntries={['/dungeons/ruby-life-pools?floor=missing-floor']}>
        <Routes>
          <Route
            path="/dungeons/:dungeonId"
            element={
              <>
                <Component />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''));
  });
});
