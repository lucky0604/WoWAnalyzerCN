import VerticallyAlignedToggle from 'interface/VerticallyAlignedToggle';
import { useExplanationContext } from 'interface/guide/components/Explanation';

interface HideExplanationToggleProps {
  id: string;
  label?: string;
  tooltipContent?: string;
}
export const HideExplanationsToggle = ({
  id,
  label,
  tooltipContent,
}: HideExplanationToggleProps) => {
  const { hideExplanations, setHideExplanations } = useExplanationContext();
  return (
    <div className="flex">
      <div className="flex-main" />
      <div className="flex-sub">
        <VerticallyAlignedToggle
          id={id}
          enabled={hideExplanations}
          setEnabled={setHideExplanations}
          label={label ?? '隐藏说明'}
          tooltipContent={
            tooltipContent ??
            '启用此功能将在指南中隐藏说明。不用担心，你可以随时重新显示。'
          }
        />
      </div>
    </div>
  );
};
