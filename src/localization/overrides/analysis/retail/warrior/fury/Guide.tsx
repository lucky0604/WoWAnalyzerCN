import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { GuideProps, Section } from 'interface/guide';
import TALENTS from 'common/TALENTS/warrior';
import { SpellLink } from 'interface';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import CombatLogParser from './CombatLogParser';
import FoundationDowntimeSectionV2 from 'interface/guide/foundation/FoundationDowntimeSectionV2';
import CooldownGraphSubsection from './guide/CooldownGraphSubSection';
import { AplSectionData } from 'interface/guide/components/Apl';
import * as AplCheck from './modules/core/AplCheck';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section title={t({ id: 'warrior.fury.section.preface', message: 'Preface & Disclaimers' })}>
        <>
          <p>
            <Trans id="warrior.fury.preface.description1">
              When reviewing this information, keep in mind that WoWAnalyzer is limited to the
              information that is present in your combat log. As a result, we have no way of knowing
              if you were intentionally doing something suboptimal because the fight or strat
              required it (such as forced downtime or holding cooldowns for a burn phase). Because
              of this, we recommend comparing your analysis against a top 100 log for the same boss.
            </Trans>
          </p>
          <p>
            <>{t({ id: 'warrior.fury.preface.description2.p1', message: 'For additional assistance in improving your gameplay, or to have someone look more in depth at your combat logs, please visit the' })}
              {' '}
              <a href="https://discord.gg/skyhold">{t({ id: 'warrior.fury.preface.description2.a', message: 'Skyhold' })}</a>
              {t({ id: 'warrior.fury.preface.description2.p2', message: 'discord.' })}
            </>
          </p>
          <p>
            <>{t({ id: 'warrior.fury.preface.description3.p1', message: 'If you notice any issues or errors in this analysis or if there is additional analysis you would like added, please ping ' })}
              <code>{t({ id: 'warrior.fury.preface.description3.code', message: '@Bigbowwl' })}</code>
              {t({ id: 'warrior.fury.preface.description3.p2', message: 'in the' })}
              {' '}
              <a href="https://discord.gg/skyhold">{t({ id: 'warrior.fury.preface.description3.a', message: 'Skyhold' })}</a>
              {t({ id: 'warrior.fury.preface.description3.p3', message: 'discord (please don\'t DM me).' })}
            </>
          </p>
        </>
      </Section>
      <Section
        title={t({ id: 'warrior.fury.section.alwaysBeCasting', message: 'Always Be Casting' })}
      >
        <FoundationDowntimeSectionV2 />
      </Section>
      <CooldownSection modules={modules} events={events} info={info} />
      <RotationSection modules={modules} events={events} info={info} />
      <PreparationSection />
    </>
  );
}

function CooldownSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={t({ id: 'warrior.fury.section.cooldowns', message: 'Cooldowns' })}>
      <CooldownGraphSubsection />
    </Section>
  );
}

function RotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={t({ id: 'warrior.fury.section.rotation', message: 'Rotation' })}>
      <p>
        <>{t({ id: 'warrior.fury.rotation.description1.p1', message: 'This single target rotation analyzer is based on a number of sources, including the guides at' })}
          {' '}
          <a
            href="https://www.wowhead.com/guide/classes/warrior/fury/rotation-cooldowns-pve-dps"
            target="_blank"
            rel="noopener noreferrer"
          >
          {t({ id: 'warrior.fury.rotation.description1.a', message: 'Wowhead' })}
        </a>
          {' and '}
          <a
            href="https://maxroll.gg/wow/class-guides/fury-warrior-raid-guide"
            target="_blank"
            rel="noopener noreferrer"
          >
          {t({ id: 'warrior.fury.rotation.description1.a2', message: 'Maxroll' })}
        </a>
          {' '}
          {t({ id: 'warrior.fury.rotation.description1.p2', message: '(credit to Archimtiros and Revvez for writing these guides).' })}
        </>
      </p>
      <p>
        <Trans id="warrior.fury.rotation.description2">
          This should be used as a reference point for improvement when comparing against other
          logs. It does not cover the full set of priorites used by Simulationcraft/Raidbots (much
          like the written guides) as the list would be far too long and too complex to follow.
        </Trans>
      </p>
      <div>
        <Trans id="warrior.fury.rotation.potentialInaccuracy">Potential areas of inaccuracy:</Trans>
        <ul>
          <li>
            <Trans id="warrior.fury.rotation.inaccuracy1">
              Holding abilities for upcoming add spawns or damage amps
            </Trans>
          </li>
          <li>
            <Trans id="warrior.fury.rotation.inaccuracy2">Multiple targets</Trans>
          </li>
          <li>
            <Trans id="warrior.fury.rotation.inaccuracy3">Movement or periods of downtime</Trans>
          </li>
        </ul>
      </div>
      <p>
        <strong>
          <Trans id="warrior.fury.rotation.note">NOTE:</Trans>
        </strong>
        <Trans id="warrior.fury.rotation.noteDescription">
          {' '}
          The priority list below does not include
        </Trans>
        <SpellLink spell={TALENTS.REND_TALENT} icon />
      </p>
      <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
    </Section>
  );
}
