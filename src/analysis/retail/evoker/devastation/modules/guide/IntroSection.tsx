import { Section } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export function IntroSection() {
  return (
    <Section
      title={t({
        id: 'guide.evoker.devastation.sections.preface.title',
        message: 'Preface',
      })}
    >
      <p>
        <Trans id="guide.evoker.devastation.sections.preface.1">
          Hello and welcome to the analyzer for the Devastation Evoker spec! All the theorycrafting
          comes from summarizing the guides over at{' '}
          <a href="https://www.wowhead.com/guide/classes/evoker/devastation/overview-pve-dps">
            Wowhead
          </a>
          , <a href="https://www.icy-veins.com/wow/devastation-evoker-pve-dps-guide">Icy Veins</a>,{' '}
          and <a href="https://discord.com/invite/evoker">Evoker Discord</a>.
        </Trans>
      </p>
      <p>
        <>{t({id:'guide.evoker.devastation.sections.preface.2.p1',message:'The accuracy and problems pointed out here are '})}<b>{t({id:'guide.evoker.devastation.sections.preface.2.bold',message:'guidelines'})}</b>{t({id:'guide.evoker.devastation.sections.preface.2.p2',message:" and don't factor in raid conditions or edge cases. To find a good measure of success, you should compare your results to other top Evokers in the same fight with Warcraft Logs (e.g "})}<a href="https://www.warcraftlogs.com/zone/rankings/46?boss=3176&class=Evoker&spec=Devastation">{t({id:'guide.evoker.devastation.sections.preface.2.link',message:'Heroic Imperator Averzian Top 100'})}</a>{t({id:'guide.evoker.devastation.sections.preface.2.p3',message:').'})}</>
      </p>
      <p>
        <Trans id="guide.evoker.devastation.sections.preface.3">
          If you have any questions, corrections, complaints, or want to help, I'm happy to talk
          over at <code>#devastation</code> in the{' '}
          <a href="https://discord.com/invite/evoker">Evoker Discord</a>.
        </Trans>
      </p>
    </Section>
  );
}
