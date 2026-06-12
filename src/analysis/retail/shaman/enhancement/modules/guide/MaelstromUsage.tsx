import SPELLS from 'common/SPELLS/shaman';
import { t } from '@lingui/core/macro';
import { SpellLink } from 'interface';
import { GuideProps, Section, SubSection } from 'interface/guide';
import CombatLogParser from '../../CombatLogParser';

const MaelstromUsage = ({ modules }: GuideProps<typeof CombatLogParser>) => {
  return (
    <Section title={t({ id: 'shaman.enhancement.resources.title', message: 'Resources' })}>
      <SubSection title={t({ id: 'shaman.enhancement.resources.maelstrom_title', message: 'Maelstrom Weapon' })}>
        <p>
          <>{t({ id: 'shaman.enhancement.resources.maelstrom_description.p1', message: "Enhancement's primary resource is " })}<SpellLink spell={SPELLS.MAELSTROM_WEAPON_BUFF} />{t({ id: 'shaman.enhancement.resources.maelstrom_description.p2', message: '. The chart below shows your ' })}<SpellLink spell={SPELLS.MAELSTROM_WEAPON_BUFF} />{t({ id: 'shaman.enhancement.resources.maelstrom_description.p3', message: ' over the source of the encounter.' })}</>
        </p>
        {modules.maelstromWeaponGraph.plot}
      </SubSection>
    </Section>
  );
};

export default MaelstromUsage;
