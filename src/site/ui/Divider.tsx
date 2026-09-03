import goldDiamond from 'site/ui/divider-diamond.svg';
import arcaneDiamond from 'site/ui/divider-diamond-arcane.svg';

interface DividerProps {
  tone?: 'gold' | 'arcane';
  className?: string;
}

/** 菱形分隔线：金为常规，紫为焦点语境 */
export function Divider({ tone = 'gold', className }: DividerProps) {
  return (
    <div
      role="separator"
      className={`divider ${tone === 'arcane' ? 'divider--arcane' : ''} ${className ?? ''}`}
    >
      <span className="divider-line" />
      <img
        src={tone === 'arcane' ? arcaneDiamond : goldDiamond}
        alt=""
        className="divider-diamond"
      />
      <span className="divider-line" />
    </div>
  );
}
