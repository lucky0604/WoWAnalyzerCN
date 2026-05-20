import SPELLS from 'common/SPELLS/shaman';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SpellLink } from 'interface';
import { GuideProps, Section, SubSection } from 'interface/guide';
import CombatLogParser from '../../CombatLogParser';

const MaelstromUsage = ({ modules }: GuideProps<typeof CombatLogParser>) => {
  return (
    <Section title={t({ id: 'shaman.enhancement.resources.title', message: 'Resources' })}>
      <SubSection title={t({ id: 'shaman.enhancement.resources.maelstrom_title', message: 'Maelstrom Weapon' })}>
        <p>
          <Trans id="shaman.enhancement.resources.maelstrom_description">
            Enhancement's primary resource is <SpellLink spell={SPELLS.MAELSTROM_WEAPON_BUFF} />. The
            chart below shows your <SpellLink spell={SPELLS.MAELSTROM_WEAPON_BUFF} /> over the source
            of the encounter.
          </Trans>
        </p>
        {modules.maelstromWeaponGraph.plot}
      </SubSection>
    </Section>
  );
};

export default MaelstromUsage;
