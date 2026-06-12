import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from 'analysis/retail/hunter/survival/CombatLogParser';
import TALENTS from 'common/TALENTS/hunter';
import SPELLS from 'common/SPELLS';
import SpellLink from 'interface/SpellLink';
import Explanation from 'interface/guide/components/Explanation';
import { FoundationDowntimeSection } from 'interface/guide/foundation/FoundationDowntimeSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export default function ActiveTime({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.hunter.survival.sections.activeTime.title',
        message: 'Active Time',
      })}
    >
      <Explanation>
        <>
          <p>
            <>
              {t({
                id: 'guide.hunter.survival.sections.activeTime.melee.p1',
                message: 'Time not spent active is lost damage. Despite being melee, Survival has many ways to continue to deal damage while out of melee range such as abilities like',
              })}
              <SpellLink spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT} />
              {t({
                id: 'guide.hunter.survival.sections.activeTime.melee.p2',
                message: ', ',
              })}
              <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} />
              {t({ id: 'guide.hunter.survival.sections.activeTime.melee.p3', message: '. ' })}
            </>
          </p>
          <p>
            <>
              {t({
                id: 'guide.hunter.survival.sections.activeTime.movement.p1',
                message: 'Hunter has a number of movement abilities, such as',
              })}
              <SpellLink spell={SPELLS.ASPECT_OF_THE_CHEETAH} />
              {t({
                id: 'guide.hunter.survival.sections.activeTime.movement.p2',
                message: ', ',
              })}
              <SpellLink spell={SPELLS.DISENGAGE} />
              {t({
                id: 'guide.hunter.survival.sections.activeTime.movement.p3',
                message: ', and',
              })}
              <SpellLink spell={SPELLS.HARPOON} />
              {t({
                id: 'guide.hunter.survival.sections.activeTime.movement.p4',
                message: ', which can be used to quickly get back to your target.',
              })}
            </>
          </p>
          <p>
            <>
              {t({
                id: 'guide.hunter.survival.sections.activeTime.eagle.p1',
                message: 'Survival also has a power short duration cooldown in',
              })}
              <SpellLink spell={SPELLS.ASPECT_OF_THE_EAGLE} />
              {t({
                id: 'guide.hunter.survival.sections.activeTime.eagle.p2',
                message: ', to be ranged for a 15 seconds, although this does not extend your auto-attacks for',
              })}
              <SpellLink spell={TALENTS.LUNGE_TALENT} />
              {t({
                id: 'guide.hunter.survival.sections.activeTime.eagle.p3',
                message: ', it does allow you to maintain good quality uptime.',
              })}
            </>
          </p>
          <p>
            <Trans id="guide.hunter.survival.sections.activeTime.compare">
              While some encounters have forced downtime, which WoWAnalyzer does not account for,
              anything you can do to minimize your downtime will help your damage. Additionally, to
              better contextualize your downtime, we recommend comparing your downtime to another
              Survival Hunter that did better than you on the same encounter with roughly the same
              kill time. If you have less downtime than them, then maybe there is something you can
              do to improve.
            </Trans>
          </p>
        </>
      </Explanation>
      <FoundationDowntimeSection />
    </Section>
  );
}
