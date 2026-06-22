import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GuideProps, Section } from 'interface/guide';
import TALENTS from 'common/TALENTS/shaman';
import CombatLogParser from '../CombatLogParser';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import Cooldowns, {
  ElementalCooldownGraphs,
} from 'analysis/retail/shaman/elemental/guide/Cooldowns';
import DefensiveAndUtility from '../../shared/guide/DefensiveAndUtility';

const PrefaceSection = () => {
  return (
    <Section title={t({ id: 'shaman.elemental.section.preface', message: 'Preface' })}>
      <p>
        <Trans id="shaman.elemental.preface.welcome">
          Hi, and welcome to the Elemental shaman WowAnalyzer page. The information on this page is
          mostly on how you can improve your DPS, however you must not put yourself in high risk of
          dying to do so. Always ensure you do appropriate mechanics correctly first, then focus on
          DPS as #2.
        </Trans>
      </p>
      <p>
        <>{t({ id: 'shaman.elemental.preface.guidelines.p1', message: 'The performance indicated here are ' })}
          <strong className="ok-mark">{t({ id: 'shaman.elemental.preface.guidelines.strong', message: 'guidelines' })}</strong>
          {t({ id: 'shaman.elemental.preface.guidelines.p2', message: ', and will vary from fight to fight and pull to pull. You should use the information here as a foundation for your own analysis.' })}
        </>
      </p>
      <p>
        <>{t({ id: 'shaman.elemental.preface.questions.p1', message: 'If you have any questions on the spec, rotation or this guide in general, you can find us in the ' })}
          <code>{t({ id: 'shaman.elemental.preface.questions.code', message: '#elemental' })}</code>
          {t({ id: 'shaman.elemental.preface.questions.p2', message: 'channel in the' })}
          {' '}
          <a href="https://discord.gg/earthshrine">{t({ id: 'shaman.elemental.preface.questions.a', message: 'Earthshrine Discord server' })}</a>
          {t({ id: 'shaman.elemental.preface.questions.p3', message: '.' })}
        </>
      </p>
    </Section>
  );
};

const ResourcesSection = (props: GuideProps<typeof CombatLogParser>) => {
  const { modules } = props;
  return (
    <Section title={t({ id: 'shaman.elemental.section.resourceUsage', message: 'Resource usage' })}>
      {modules.maelstromDetails.guideSubsection}
      {modules.alwaysBeCasting.guideSubsection}
    </Section>
  );
};

/** A section for the core combo, abilities and buffs. */
const CoreSection = (props: GuideProps<typeof CombatLogParser>) => {
  const { info, modules } = props;
  return (
    <>
      {info.combatant.hasTalent(TALENTS.CALL_OF_THE_ANCESTORS_TALENT) &&
        modules.callOfTheAncestors.guideSubsection}
      {modules.maelstromSpenders.guideSubsection}
      {modules.flameShock.guideSubsection}
    </>
  );
};

/** The guide for Elemental Shamans. */
export default function ElementalGuide(props: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <PrefaceSection />
      <Section title={t({ id: 'shaman.elemental.section.guide', message: 'Guide' })}>
        <Cooldowns {...props} />
        <CoreSection {...props} />
        <ElementalCooldownGraphs />
      </Section>
      <ResourcesSection {...props} />
      <DefensiveAndUtility />
      <PreparationSection />
    </>
  );
}
