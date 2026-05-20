import { useAnalyzer, useInfo } from 'interface/guide/index';
import { PanelHeader, PerformanceRoundedPanel } from 'interface/guide/components/GuideDivs';
import PotionChecker from 'parser/retail/modules/items/PotionChecker';
import ClassicPotionChecker from 'parser/classic/modules/items/PotionChecker';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import ItemLink from 'interface/ItemLink';
import Potion from 'interface/icons/Potion';
import Expansion, { CLASSIC_EXPANSION } from 'game/Expansion';

interface Props {
  expansion?: Expansion;
}
const PotionPanel = ({ expansion }: Props) => {
  const UsePotionChecker = expansion === CLASSIC_EXPANSION ? ClassicPotionChecker : PotionChecker;
  const potionChecker = useAnalyzer(UsePotionChecker);
  const info = useInfo();
  if (!potionChecker || !info) {
    return null;
  }

  const weakPotionsUsed = potionChecker.weakPotionsUsed;
  const potionsUsed = potionChecker.potionsUsed;
  const maxPotions = potionChecker.maxPotions;
  const strongPotionId = potionChecker.strongPotionId;
  const suggestionMessage = potionChecker.suggestionMessage;

  let performance = QualitativePerformance.Good;
  if (weakPotionsUsed > 0) {
    performance = QualitativePerformance.Ok;
  }
  if (potionsUsed < maxPotions) {
    performance = QualitativePerformance.Fail;
  }

  return (
    <PerformanceRoundedPanel performance={performance}>
      <PanelHeader className="flex">
        <div className="flex-main">
          <strong>使用药水数量</strong>
        </div>
        <div className="flex-sub">
          <Potion />
        </div>
      </PanelHeader>
      {performance !== QualitativePerformance.Fail && (
        <p>
          你在本场战斗中使用了合适数量的药水（{potionsUsed}/{maxPotions}）！
          做得好！
        </p>
      )}
      {performance === QualitativePerformance.Fail && (
        <p>
          你在本场战斗中使用了 {potionsUsed} 瓶战斗药水，但本可以使用 {maxPotions} 瓶。
          {suggestionMessage}
        </p>
      )}
      {weakPotionsUsed > 0 && (
        <>
          <PanelHeader>
            <strong>使用药水品质</strong>
          </PanelHeader>
          <p>
            你使用了 {weakPotionsUsed} 瓶低品质药水。请使用{' '}
            <ItemLink id={strongPotionId} /> 以获得更好效果。
          </p>
        </>
      )}
    </PerformanceRoundedPanel>
  );
};

export default PotionPanel;
