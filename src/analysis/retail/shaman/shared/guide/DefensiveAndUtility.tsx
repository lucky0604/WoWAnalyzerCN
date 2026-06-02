import TALENTS from 'common/TALENTS/shaman';
import { Section } from 'interface/guide';
import CooldownGraphSubsection, {
  Cooldown,
} from 'interface/guide/components/CooldownGraphSubSection';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const defensiveTalents: Cooldown[] = [
  { spell: TALENTS.ASTRAL_SHIFT_TALENT, isActive: (c) => c.hasTalent(TALENTS.ASTRAL_SHIFT_TALENT) },
  {
    spell: TALENTS.EARTH_ELEMENTAL_TALENT,
    isActive: (c) => c.hasTalent(TALENTS.EARTH_ELEMENTAL_TALENT),
  },
  {
    spell: TALENTS.NATURES_SWIFTNESS_TALENT,
    isActive: (c) =>
      c.hasTalent(TALENTS.NATURES_SWIFTNESS_TALENT) &&
      !c.hasTalent(TALENTS.ANCESTRAL_SWIFTNESS_TALENT),
  },
  {
    spell: TALENTS.SPIRITWALKERS_GRACE_TALENT,
    isActive: (c) => c.hasTalent(TALENTS.SPIRITWALKERS_GRACE_TALENT),
  },
];

export default function DefensiveAndUtility() {
  return (
    <>
      <Section
        title={t({
          id: 'shaman.shared.defensive_and_utility.section_title',
          message: 'Defensive and utility',
        })}
      >
        <CooldownGraphSubsection
          cooldowns={defensiveTalents}
          description={
            <p>
              <strong>
                {t({
                  id: 'shaman.shared.defensive_and_utility.title',
                  message: 'Defensives and utility',
                })}
              </strong>{' '}
              -{' '}
              <Trans id="shaman.shared.defensive_and_utility.description">
                Defensive and utility talent usage may vary from fight to fight. They may need to be
                delayed for specific mechanics. In general, any amount of usage is good, but
                anywhere you could fit in another usage is a theoretical loss.
              </Trans>
            </p>
          }
        />
      </Section>
    </>
  );
}
