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
      <Section title={t({ id: 'warrior.arms.section.preface', message: 'Preface & Disclaimers' })}>
        <>
          <p>
            <Trans id="warrior.arms.preface.description1">
              When reviewing this information, keep in mind that WoWAnalyzer is limited to the
              information that is present in your combat log. As a result, we have no way of knowing
              if you were intentionally doing something suboptimal because the fight or strat
              required it (such as forced downtime or holding cooldowns for a burn phase). Because
              of this, we recommend comparing your analysis against a top 100 log for the same boss.
            </Trans>
          </p>
          <p>
            <Trans id="warrior.arms.preface.description2">
              For additional assistance in improving your gameplay, or to have someone look more in
              depth at your combat logs, please visit the{' '}
              <a href="https://discord.gg/skyhold">Skyhold</a> discord.
            </Trans>
          </p>
          <p>
            <Trans id="warrior.arms.preface.description3">
              If you notice any issues or errors in this analysis or if there is additional analysis
              you would like added, please ping <code>@Bigbowwl</code> in the{' '}
              <a href="https://discord.gg/skyhold">Skyhold</a> discord (please don't DM me).
            </Trans>
          </p>
        </>
      </Section>
      <Section
        title={t({ id: 'warrior.arms.section.alwaysBeCasting', message: 'Always Be Casting' })}
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
    <Section title={t({ id: 'warrior.arms.section.cooldowns', message: 'Cooldowns' })}>
      <CooldownGraphSubsection />
    </Section>
  );
}

function RotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={t({ id: 'warrior.arms.section.rotation', message: 'Rotation' })}>
      <p>
        <Trans id="warrior.arms.rotation.description1">
          This single target rotation analyzer is based on a number of sources, including the guides
          at{' '}
          <a
            href="https://www.wowhead.com/guide/classes/warrior/arms/rotation-cooldowns-pve-dps"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wowhead
          </a>
          {' and '}
          <a
            href="https://maxroll.gg/wow/class-guides/arms-warrior-raid-guide"
            target="_blank"
            rel="noopener noreferrer"
          >
            Maxroll
          </a>{' '}
          (credit to Archimtiros and Revvez for writing these guides).
        </Trans>
      </p>
      <p>
        <Trans id="warrior.arms.rotation.description2">
          This should be used as a reference point for improvement when comparing against other
          logs. It does not cover the full set of priorites used by Simulationcraft/Raidbots (much
          like the written guides) as the list would be far too long and too complex to follow.
        </Trans>
      </p>
      <div>
        <Trans id="warrior.arms.rotation.potentialInaccuracy">Potential areas of inaccuracy:</Trans>
        <ul>
          <li>
            <Trans id="warrior.arms.rotation.inaccuracy1">
              Holding abilities for upcoming add spawns or damage amps
            </Trans>
          </li>
          <li>
            <Trans id="warrior.arms.rotation.inaccuracy2">Multiple targets</Trans>
          </li>
          <li>
            <Trans id="warrior.arms.rotation.inaccuracy3">Movement or periods of downtime</Trans>
          </li>
        </ul>
      </div>
      <p>
        <strong>
          <Trans id="warrior.arms.rotation.note">NOTE:</Trans>
        </strong>
        <Trans id="warrior.arms.rotation.noteDescription">
          {' '}
          The priority list below does not include
        </Trans>
        <SpellLink spell={TALENTS.REND_TALENT} icon />
      </p>
      <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
    </Section>
  );
}
