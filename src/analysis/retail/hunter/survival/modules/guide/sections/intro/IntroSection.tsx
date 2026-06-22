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
        <>{t({ id: 'guide.hunter.survival.sections.intro.welcome.p1', message: 'Hello and welcome to the analyzer for the Survival Hunter spec! All the theorycrafting comes from summarizing the guides over at' })}
          {' '}
          <a href="https://www.wowhead.com/guide/classes/hunter/survival/overview-pve-dps">{t({ id: 'guide.hunter.survival.sections.intro.welcome.a', message: 'Wowhead' })}</a>
          {t({ id: 'guide.hunter.survival.sections.intro.welcome.p2', message: ', ' })}
          <a href="https://www.icy-veins.com/wow/survival-hunter-pve-dps-guide">{t({ id: 'guide.hunter.survival.sections.intro.welcome.a2', message: 'Icy Veins' })}</a>
          {t({ id: 'guide.hunter.survival.sections.intro.welcome.p3', message: ', and the ' })}
          <a href="https://discord.com/invite/trueshot">{t({ id: 'guide.hunter.survival.sections.intro.welcome.a3', message: 'Hunter Discord' })}</a>
          {t({ id: 'guide.hunter.survival.sections.intro.welcome.p4', message: '.' })}
        </>
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
        <>{t({ id: 'guide.hunter.survival.sections.intro.questions.p1', message: 'If you have any questions, corrections, complaints, or want to help, I\'m happy to talk over at ' })}
          <code>{t({ id: 'guide.hunter.survival.sections.intro.questions.code', message: '#survival' })}</code>
          {t({ id: 'guide.hunter.survival.sections.intro.questions.p2', message: 'in the' })}
          {' '}
          <a href="https://discord.com/invite/trueshot">{t({ id: 'guide.hunter.survival.sections.intro.questions.a', message: 'Hunter Discord' })}</a>
          {t({ id: 'guide.hunter.survival.sections.intro.questions.p3', message: '.' })}
        </>
      </p>
    </Section>
  );
}
