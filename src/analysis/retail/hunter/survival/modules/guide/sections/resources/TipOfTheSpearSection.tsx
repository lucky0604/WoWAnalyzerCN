import CombatLogParser from 'analysis/retail/hunter/survival/CombatLogParser';
import TALENTS from 'common/TALENTS/hunter';
import { SpellLink } from 'interface';
import { ModulesOf, Section, SubSection } from 'interface/guide';
import { t } from '@lingui/core/macro';

export default function TipOfTheSpearSection(modules: ModulesOf<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.hunter.survival.sections.tipOfTheSpear.title',
        message: 'Tip of the Spear',
      })}
    >
      <p>
        <>
          <SpellLink spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT} />
          {t({
            id: 'guide.hunter.survival.sections.tipOfTheSpear.summary.p1',
            message: ' ',
          })}
          <strong>
            {t({
              id: 'guide.hunter.survival.sections.tipOfTheSpear.summary.bold',
              message: 'builds',
            })}
          </strong>
          {t({
            id: 'guide.hunter.survival.sections.tipOfTheSpear.summary.p2',
            message: ' ',
          })}
          <SpellLink spell={TALENTS.TIP_OF_THE_SPEAR_TALENT} />
          {t({
            id: 'guide.hunter.survival.sections.tipOfTheSpear.summary.p3',
            message: ' stacks. These stacks are consumed one per cast of your direct-damage abilities. Avoid wasting stacks by timing your Kill Commands carefully, and always cast tippable abilities with at least one stack active. The aim for survival is to spend before you generate which means even though you have the room for focus and tip at 1 stack, you should still spend it prior to generating more.',
          })}
        </>
      </p>
      <p>
        <>
          {t({
            id: 'guide.hunter.survival.sections.tipOfTheSpear.wasted.p1',
            message: 'You wasted ',
          })}
          <strong>{modules.tipOfTheSpear.wastedStacks}</strong>
          {t({
            id: 'guide.hunter.survival.sections.tipOfTheSpear.wasted.p2',
            message: ' stack',
          })}
          {modules.tipOfTheSpear.wastedStacks !== 1 ? 's' : ''}
          {t({
            id: 'guide.hunter.survival.sections.tipOfTheSpear.wasted.p3',
            message: ' of ',
          })}
          <SpellLink spell={TALENTS.TIP_OF_THE_SPEAR_TALENT} />
          {t({ id: 'guide.hunter.survival.sections.tipOfTheSpear.wasted.p4', message: '.' })}
        </>
      </p>
      <p>
        <strong>
<>
            {t({
              id: 'guide.hunter.survival.sections.tipOfTheSpear.note.p1',
              message: "Tip of the Spear does not buff the periodic damage of abilities like ",
            })}
            <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} />
            {t({ id: 'guide.hunter.survival.sections.tipOfTheSpear.note.p3', message: '.' })}
          </>
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
