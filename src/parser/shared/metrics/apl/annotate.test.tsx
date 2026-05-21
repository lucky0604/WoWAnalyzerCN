import { act, render } from '@testing-library/react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from 'store';
import { TooltipProvider } from 'interface/TooltipContext';

import { ConditionDescription } from './annotate';
import { buffPresent } from './conditions';
import { InternalRule, TargetType } from './index';

describe('ConditionDescription', () => {
  it('should return no description for unconditional rules', () => {
    act(() => {
      const { container } = render(
        <ReduxProvider store={store}>
          <TooltipProvider>
            <ConditionDescription
              rule={{ spell: { type: TargetType.Spell, target: { id: 1, name: 'Test', icon: '' } } }}
            />
          </TooltipProvider>
        </ReduxProvider>,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should return a description for a rule with a condition', () => {
    const rule: InternalRule = {
      spell: { type: TargetType.Spell, target: { id: 1, name: 'Test', icon: '' } },
      condition: buffPresent({ id: 2, name: 'Buff', icon: '' }),
    };

    act(() => {
      const { container } = render(
        <ReduxProvider store={store}>
          <TooltipProvider>
            <ConditionDescription rule={rule} />
          </TooltipProvider>
        </ReduxProvider>,
      );

      expect(container).toMatchSnapshot();
    });
  });
});
