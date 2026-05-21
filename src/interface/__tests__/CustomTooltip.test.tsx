import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import CustomTooltip from '../CustomTooltip';

describe('CustomTooltip', () => {
  const defaultProps = {
    content: '<a href="https://wow.zamimg.com/test.png">test</a>',
    position: { x: 100, y: 200 },
    onClose: vi.fn(),
  };

  it('replaces wow.zamimg.com with wsrv.nl proxy', () => {
    const { container } = render(<CustomTooltip {...defaultProps} />);
    const div = container.firstChild as HTMLElement;
    expect(div.innerHTML).toContain('wsrv.nl/?url=https://wow.zamimg.com');
  });

  it('replaces images.wowhead.com with wsrv.nl proxy', () => {
    const { container } = render(
      <CustomTooltip
        {...defaultProps}
        content='<img src="https://images.wowhead.com/icon.jpg" />'
      />,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.innerHTML).toContain('wsrv.nl/?url=https://images.wowhead.com');
  });

  it('calls onClose when clicking outside', () => {
    const onClose = vi.fn();
    render(<CustomTooltip {...defaultProps} onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside tooltip', () => {
    const onClose = vi.fn();
    const { container } = render(
      <CustomTooltip {...defaultProps} onClose={onClose} />,
    );
    const tooltip = container.firstChild as HTMLElement;
    fireEvent.mouseDown(tooltip);
    expect(onClose).not.toHaveBeenCalled();
  });
});
