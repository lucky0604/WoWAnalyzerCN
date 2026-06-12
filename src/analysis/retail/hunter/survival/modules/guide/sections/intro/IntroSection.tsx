import { Section } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export function IntroSection() {
  return (
    <Section
      title={t({
        id: 'guide.hunter.survival.sections.intro.title',
        message: 'Preface',
      })}
    >
      <p>
        <Trans id="guide.hunter.survival.sections.intro.welcome">
          Hello and welcome to the analyzer for the Survival Hunter spec! All the theorycrafting
          comes from summarizing the guides over at{' '}
          <a href="https://www.wowhead.com/guide/classes/hunter/survival/overview-pve-dps">
            Wowhead
          </a>
          , <a href="https://www.icy-veins.com/wow/survival-hunter-pve-dps-guide">Icy Veins</a>, and
          the <a href="https://discord.com/invite/trueshot">Hunter Discord</a>.
        </Trans>
      </p>
      <p>
        <>
          <b>
            {t({
              id: 'guide.hunter.survival.sections.intro.accuracy.bold',
              message: 'guidelines',
            })}
          </b>
          {t({
            id: 'guide.hunter.survival.sections.intro.accuracy.p1',
            message: " and don't factor in raid conditions or edge cases. To find a good measure of success, you should compare your results to other top Hunters in the same fight with Warcraft Logs (e.g ",
          })}
          <a href="https://www.warcraftlogs.com/zone/rankings/46?boss=3176&class=Hunter&spec=Survival">
            {t({
              id: 'guide.hunter.survival.sections.intro.accuracy.link',
              message: 'Heroic Imperator Averzian Top 100',
            })}
          </a>
          {t({ id: 'guide.hunter.survival.sections.intro.accuracy.p2', message: ').' })}
        </>
      </p>
      <p>
        <Trans id="guide.hunter.survival.sections.intro.questions">
          If you have any questions, corrections, complaints, or want to help, I'm happy to talk
          over at <code>#survival</code> in the{' '}
          <a href="https://discord.com/invite/trueshot">Hunter Discord</a>.
        </Trans>
      </p>
    </Section>
  );
}
