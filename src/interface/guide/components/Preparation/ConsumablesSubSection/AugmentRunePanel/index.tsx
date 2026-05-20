import AugmentRuneChecker from 'parser/retail/modules/items/AugmentRuneChecker';
import { useAnalyzer, useInfo } from 'interface/guide';
import { PanelHeader, PerformanceRoundedPanel } from 'interface/guide/components/GuideDivs';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import SpellLink from 'interface/SpellLink';

const AugmentRunePanel = () => {
  const augmentRuneChecker = useAnalyzer(AugmentRuneChecker);
  const info = useInfo();
  if (!augmentRuneChecker || !augmentRuneChecker.active || !info) {
    return null;
  }

  const startFightWithAugmentRuneUp = augmentRuneChecker.startFightWithAugmentRuneUp;
  const uptimePercentage = augmentRuneChecker.augmentRuneUptimePercentage;
  const augmentRuneSpellId = augmentRuneChecker.augmentRuneSpellId;
  const showCurrentAugmentRune = augmentRuneSpellId ? (
    <>
      : <SpellLink spell={augmentRuneSpellId} />
    </>
  ) : (
    <>.</>
  );

  let performance = QualitativePerformance.Fail;
  if (startFightWithAugmentRuneUp) {
    if (uptimePercentage < 1) {
      performance = QualitativePerformance.Ok;
    } else {
      performance = QualitativePerformance.Good;
    }
  }

  return (
    <PerformanceRoundedPanel performance={performance}>
      <PanelHeader className="flex">
        <div className="flex-main">
          <strong>增强符文使用</strong>
        </div>
      </PanelHeader>
      {performance === QualitativePerformance.Good && (
        <p>你在整场战斗中激活了增强符文{showCurrentAugmentRune}</p>
      )}
      {performance === QualitativePerformance.Ok && (
        <p>你没有在整场战斗中保持增强符文激活。{showCurrentAugmentRune}</p>
      )}
      {performance === QualitativePerformance.Fail && (
        <p>你在战斗中未激活增强符文{showCurrentAugmentRune}</p>
      )}
    </PerformanceRoundedPanel>
  );
};

export default AugmentRunePanel;
