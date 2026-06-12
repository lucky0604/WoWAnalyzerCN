import type { JSX } from 'react';
import { Section, SubSection, useAnalyzer, useInfo } from 'interface/guide';
import Para from 'interface/guide/Para';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { FoundationCooldownSection } from 'interface/guide/foundation/FoundationCooldownSection';
import FoundationDowntimeSectionV2 from 'interface/guide/foundation/FoundationDowntimeSectionV2';
import { useExpansionContext } from 'interface/report/ExpansionContext';
import { Enchant } from 'common/ITEMS/Item';
import ENCHANTS from 'common/ITEMS/classic/enchants';
import { GearSlotName } from 'parser/core/Combatant';
import { t } from '@lingui/core/macro';
import AlwaysBeCasting from './modules/features/AlwaysBeCasting';

// 潘达利亚之谜版本狂怒战士最佳附魔（来自 wowsims/mop 装备套装）
const RECOMMENDED_ENCHANTS: Partial<Record<GearSlotName, Enchant[]>> = {
  SHOULDER: [ENCHANTS.GREATER_TIGER_FANG_INSCRIPTION],
  BACK: [ENCHANTS.ENCHANT_CLOAK_SUPERIOR_CRITICAL_STRIKE],
  CHEST: [ENCHANTS.ENCHANT_CHEST_GLORIOUS_STATS],
  WRISTS: [ENCHANTS.ENCHANT_BRACER_EXCEPTIONAL_STRENGTH],
  HANDS: [ENCHANTS.ENCHANT_GLOVES_SUPER_STRENGTH],
  LEGS: [ENCHANTS.ANGERHIDE_LEG_ARMOR],
  FEET: [ENCHANTS.ENCHANT_BOOTS_PANDARENS_STEP],
  MAINHAND: [ENCHANTS.ENCHANT_WEAPON_DANCING_STEEL],
  OFFHAND: [ENCHANTS.ENCHANT_WEAPON_DANCING_STEEL],
};

export default function Guide(): JSX.Element {
  const { expansion } = useExpansionContext();
  return (
    <>
      <Section title={t({ id: 'classic.warrior.fury.guide.coreSkills', message: 'Core Skills' })}>
        <FuryDowntimeSection />
        <FoundationCooldownSection />
      </Section>
      <PreparationSection expansion={expansion} recommendedEnchantments={RECOMMENDED_ENCHANTS} />
    </>
  );
}

function FuryDowntimeSection() {
  const info = useInfo();
  const alwaysBeCasting = useAnalyzer(AlwaysBeCasting);

  if (!info || !alwaysBeCasting) {
    return null;
  }

  return (
    <SubSection
      title={t({ id: 'classic.warrior.fury.guide.alwaysBeCasting', message: 'Always Be Casting' })}
    >
      <Para>
        <small>
          {t({
            id: 'classic.warrior.fury.guide.alwaysBeCasting.description',
            message:
              'As a Fury Warrior your damage comes from keeping a steady stream of attacks going. Try to minimize the time spent doing nothing — as long as you have {rage} and an ability off cooldown, you should be pressing a button. GCDs that are empty because no abilities are usable are also counted as Active Time.',
          })}
        </small>
      </Para>
      <FoundationDowntimeSectionV2 />
    </SubSection>
  );
}
