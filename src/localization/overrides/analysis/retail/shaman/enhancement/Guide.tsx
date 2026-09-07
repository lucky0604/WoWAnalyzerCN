import { GuideProps, Section } from 'interface/guide';
import TALENTS from 'common/TALENTS/shaman';
import CombatLogParser from './CombatLogParser';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import MaelstromUsage from './modules/guide/MaelstromUsage';
import Cooldowns from './modules/guide/Cooldowns';
import DefensiveAndUtility from '../shared/guide/DefensiveAndUtility';
import { Seriousnes } from 'CONTRIBUTORS';
import Contributor from 'interface/ContributorButton';
import FoundationDowntimeSectionV2 from 'interface/guide/foundation/FoundationDowntimeSectionV2';
import { TIERS } from 'game/TIERS';
import ItemSetLink from 'interface/ItemSetLink';
import { SHAMAN_MID2_ID } from 'common/ITEMS';
import { t } from '@lingui/core/macro';

export default function Guide(props: GuideProps<typeof CombatLogParser>) {
  const combatant = props.info.combatant;
  const isTotemic = combatant.hasTalent(TALENTS.SURGING_TOTEM_TALENT);
  const isStormbringer = combatant.hasTalent(TALENTS.TEMPEST_TALENT);
  const hasMid2TierSet =
    combatant.has2PieceByTier(TIERS.MID2) || combatant.has4PieceByTier(TIERS.MID2);

  return (
    <>
      <Section title={t({ id: 'shaman.enhancement.section.preface', message: 'Preface & Disclaimers' })}>
        <>
          <p>
            <>{t({ id: 'shaman.enhancement.preface.analysis.p1', message: 'The analysis in this guide is provided by ' })}
              <Contributor {...Seriousnes} />
              {t({ id: 'shaman.enhancement.preface.analysis.p2', message: ' in collaboration with the members and staff of the' })}
              {' '}
              <a href="https://discord.gg/earthshrine">{t({ id: 'shaman.enhancement.preface.analysis.a', message: 'Earthshrine' })}</a>
              {t({ id: 'shaman.enhancement.preface.analysis.p3', message: ' Shaman discord. When reviewing this information, keep in mind that WoWAnalyzer is limited to the information that is present in your combat log. As a result, we have no way of knowing if you were intentionally doing something suboptimal because the fight or strat required it (such as Forced Downtime or holding cooldowns for a burn phase). Because of this, we recommend comparing your analysis against a top 100 log for the same boss.' })}
            </>
          </p>
          <p>
            <>{t({ id: 'shaman.enhancement.preface.assistance.p1', message: 'For additional assistance in improving your gameplay, or to have someone look more in depth at your combat logs, please visit the' })}
              {' '}
              <a href="https://discord.gg/earthshrine">{t({ id: 'shaman.enhancement.preface.assistance.a', message: 'Earthshrine' })}</a>
              {t({ id: 'shaman.enhancement.preface.assistance.p2', message: ' discord.' })}
            </>
          </p>
          <p>
            <>{t({ id: 'shaman.enhancement.preface.issues.p1', message: 'If you notice any issues or errors in this analysis or if there is additional analysis you would like added, please ping ' })}
              <code>{t({ id: 'shaman.enhancement.preface.issues.code', message: '@Seriousnes' })}</code>
              {t({ id: 'shaman.enhancement.preface.issues.p2', message: ' in the' })}
              {' '}
              <a href="https://discord.gg/earthshrine">{t({ id: 'shaman.enhancement.preface.issues.a', message: 'Earthshrine' })}</a>
              {t({ id: 'shaman.enhancement.preface.issues.p3', message: ' discord.' })}
            </>
          </p>
        </>
      </Section>
      <Section title={t({ id: 'shaman.enhancement.section.heroTalent', message: 'Hero Talent' })}>
        {isTotemic && props.modules.surgingTotem.guideSubsection}
        {isStormbringer && props.modules.tempest.guideSubsection}
      </Section>
      {hasMid2TierSet && (
        <Section
          title={
            <>
              <ItemSetLink id={SHAMAN_MID2_ID}>
                {t({ id: 'shaman.enhancement.section.mid2TierSet', message: "Midnight Season 2 Tier Set (Ophidian Oracle's Prophecy)" })}
              </ItemSetLink>
            </>
          }
        >
          {props.modules.s2TierSet.guideSubsection}
        </Section>
      )}
      <Cooldowns {...props} />
      <Section title={t({ id: 'shaman.enhancement.section.alwaysBeCasting', message: 'Always Be Casting' })}>
        <FoundationDowntimeSectionV2 />
      </Section>
      <MaelstromUsage {...props} />
      <DefensiveAndUtility />
      <PreparationSection />
    </>
  );
}
