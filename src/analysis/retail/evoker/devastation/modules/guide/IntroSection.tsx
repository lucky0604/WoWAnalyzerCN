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
        <>{t({ id: 'guide.evoker.devastation.sections.preface.1.p1', message: 'Hello and welcome to the analyzer for the Devastation Evoker spec! All the theorycrafting comes from summarizing the guides over at' })}
          {' '}
          <a href="https://www.wowhead.com/guide/classes/evoker/devastation/overview-pve-dps">{t({ id: 'guide.evoker.devastation.sections.preface.1.a', message: 'Wowhead' })}</a>
          {t({ id: 'guide.evoker.devastation.sections.preface.1.p2', message: ', ' })}
          <a href="https://www.icy-veins.com/wow/devastation-evoker-pve-dps-guide">{t({ id: 'guide.evoker.devastation.sections.preface.1.a2', message: 'Icy Veins' })}</a>
          {t({ id: 'guide.evoker.devastation.sections.preface.1.p3', message: ',' })}
          {' '}
          {t({ id: 'guide.evoker.devastation.sections.preface.1.p4', message: 'and ' })}
          <a href="https://discord.com/invite/evoker">{t({ id: 'guide.evoker.devastation.sections.preface.1.a3', message: 'Evoker Discord' })}</a>
          {t({ id: 'guide.evoker.devastation.sections.preface.1.p5', message: '.' })}
        </>
      </p>
      <p>
        <>{t({id:'guide.evoker.devastation.sections.preface.2.p1',message:'The accuracy and problems pointed out here are '})}<b>{t({id:'guide.evoker.devastation.sections.preface.2.bold',message:'guidelines'})}</b>{t({id:'guide.evoker.devastation.sections.preface.2.p2',message:" and don't factor in raid conditions or edge cases. To find a good measure of success, you should compare your results to other top Evokers in the same fight with Warcraft Logs (e.g "})}<a href="https://www.warcraftlogs.com/zone/rankings/46?boss=3176&class=Evoker&spec=Devastation">{t({id:'guide.evoker.devastation.sections.preface.2.link',message:'Heroic Imperator Averzian Top 100'})}</a>{t({id:'guide.evoker.devastation.sections.preface.2.p3',message:').'})}</>
      </p>
      <p>
        <>{t({ id: 'guide.evoker.devastation.sections.preface.3.p1', message: 'If you have any questions, corrections, complaints, or want to help, I\'m happy to talk over at ' })}
          <code>{t({ id: 'guide.evoker.devastation.sections.preface.3.code', message: '#devastation' })}</code>
          {t({ id: 'guide.evoker.devastation.sections.preface.3.p2', message: 'in the' })}
          {' '}
          <a href="https://discord.com/invite/evoker">{t({ id: 'guide.evoker.devastation.sections.preface.3.a', message: 'Evoker Discord' })}</a>
          {t({ id: 'guide.evoker.devastation.sections.preface.3.p3', message: '.' })}
        </>
      </p>
    </Section>
  );
}
