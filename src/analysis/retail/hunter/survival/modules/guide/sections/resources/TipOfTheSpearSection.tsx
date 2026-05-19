import CombatLogParser from 'analysis/retail/hunter/survival/CombatLogParser';
import TALENTS from 'common/TALENTS/hunter';
import { SpellLink } from 'interface';
import { ModulesOf, Section, SubSection } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default function TipOfTheSpearSection(modules: ModulesOf<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.hunter.survival.sections.tipOfTheSpear.title',
        message: 'Tip of the Spear',
      })}
    >
      <p>
        <Trans id="guide.hunter.survival.sections.tipOfTheSpear.summary">
          <SpellLink spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT} /> <strong>builds</strong>{' '}
          <SpellLink spell={TALENTS.TIP_OF_THE_SPEAR_TALENT} /> stacks. These stacks are consumed
          one per cast of your direct-damage abilities. Avoid wasting stacks by timing your Kill
          Commands carefully, and always cast tippable abilities with at least one stack active.
        </Trans>
      </p>
      <p>
        <Trans id="guide.hunter.survival.sections.tipOfTheSpear.wasted">
          You wasted <strong>{modules.tipOfTheSpear.wastedStacks}</strong> stack
          {modules.tipOfTheSpear.wastedStacks !== 1 ? 's' : ''} of{' '}
          <SpellLink spell={TALENTS.TIP_OF_THE_SPEAR_TALENT} />.
        </Trans>
      </p>
      <p>
        <strong>
          <Trans id="guide.hunter.survival.sections.tipOfTheSpear.note">
            Tip of the Spear does not buff the periodic damage of abilities like{' '}
            <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} /> or{' '}
            <SpellLink spell={TALENTS.FLAMEFANG_PITCH_TALENT} />.
          </Trans>
        </strong>
      </p>
      <SubSection
        title={t({
          id: 'guide.hunter.survival.sections.tipOfTheSpear.killCommand.title',
          message: 'Kill Command — Stack Generation',
        })}
      >
        {modules.tipOfTheSpear.guideSubsectionKillCommand}
      </SubSection>
      <SubSection
        title={t({
          id: 'guide.hunter.survival.sections.tipOfTheSpear.untipped.title',
          message: 'Abilities Cast Without Tip of the Spear',
        })}
      >
        {modules.tipOfTheSpear.guideSubsectionUntipped}
      </SubSection>
    </Section>
  );
}
