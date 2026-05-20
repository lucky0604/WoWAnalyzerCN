import { t } from '@lingui/core/macro';
import { SubSection, useAnalyzer, useInfo } from 'interface/guide/index';
import EnchantChecker from 'parser/shared/modules/items/EnchantChecker';
import EnchantmentBoxRow from 'interface/guide/components/Preparation/EnchantmentSubSection/EnchantmentBoxRow';
import { Enchant } from 'common/ITEMS/Item';
import { GearSlotName } from 'parser/core/Combatant';

interface Props {
  recommendedEnchantments?: Partial<Record<GearSlotName, Enchant[]>>;
}
const EnchantmentSubSection = ({ recommendedEnchantments }: Props) => {
  const enchantChecker = useAnalyzer(EnchantChecker);
  const info = useInfo();
  if (!enchantChecker || !info) {
    return null;
  }

  return (
    <SubSection
      title={t({
        id: 'guide.preparation.enchants',
        message: 'Enchants',
      })}
    >
      <p>附魔是提升你输出的简单方式。</p>
      <EnchantmentBoxRow
        values={enchantChecker.getEnchantmentBoxRowEntries(recommendedEnchantments)}
      />
    </SubSection>
  );
};

export default EnchantmentSubSection;
