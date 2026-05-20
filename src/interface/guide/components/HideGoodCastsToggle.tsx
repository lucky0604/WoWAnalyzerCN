import VerticallyAlignedToggle from 'interface/VerticallyAlignedToggle';
import { useSpellUsageContext } from 'parser/core/SpellUsage/core';

interface HideGoodCastsToggleProps {
  id: string;
  label?: string;
  tooltipContent?: string;
}
export const HideGoodCastsToggle = ({ id, label, tooltipContent }: HideGoodCastsToggleProps) => {
  const { hideGoodCasts, setHideGoodCasts } = useSpellUsageContext();
  return (
    <div className="flex">
      <div className="flex-main" />
      <div className="flex-sub">
        <VerticallyAlignedToggle
          id={id}
          enabled={hideGoodCasts}
          setEnabled={setHideGoodCasts}
          label={label ?? '隐藏良好施法'}
          tooltipContent={
            tooltipContent ??
            '启用此功能将在指南中隐藏良好和完美施法。不用担心，你可以随时重新显示。'
          }
        />
      </div>
    </div>
  );
};
