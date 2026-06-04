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
      <Section title={<Trans id="warrior.fury.section.preface" message="Preface &amp; Disclaimers" />}>
        <>
          <p>
            <Trans id="warrior.fury.preface.description1" message="When reviewing this information, keep in mind that WoWAnalyzer is limited to the information that is present in your combat log. As a result, we have no way of knowing if you were intentionally doing something suboptimal because the fight or strat required it (such as forced downtime or holding cooldowns for a burn phase). Because of this, we recommend comparing your analysis against a top 100 log for the same boss." />
          </p>
          <p>
            <Trans id="warrior.fury.preface.description2" message="For additional assistance in improving your gameplay, or to have someone look more in depth at your combat logs, please visit the <0>Skyhold</0> discord.">
              {() => [<a href="https://discord.gg/skyhold" />]}
            </Trans>
          </p>
          <p>
            <Trans id="warrior.fury.preface.description3" message="If you notice any issues or errors in this analysis or if there is additional analysis you would like added, please ping <0>@Bigbowwl</0> in the <1>Skyhold</1> discord (please don&apos;t DM me).">
              {() => [<code />, <a href="https://discord.gg/skyhold" />]}
            </Trans>
          </p>
        </>
      </Section>
      <Section title={<Trans id="warrior.fury.section.alwaysBeCasting" message="Always Be Casting" />}>
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
    <Section title={<Trans id="warrior.fury.section.cooldowns" message="Cooldowns" />}>
      <CooldownGraphSubsection />
    </Section>
  );
}

function RotationSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return (
    <Section title={<Trans id="warrior.fury.section.rotation" message="Rotation" />}>
      <p>
        <Trans id="warrior.fury.rotation.description1" message="This single target rotation analyzer is based on a number of sources, including the guides at <0>Wowhead</0> and <1>Maxroll</1> (credit to Archimtiros and Revvez for writing these guides).">
          {() => [
            <a href="https://www.wowhead.com/guide/classes/warrior/fury/rotation-cooldowns-pve-dps" target="_blank" rel="noopener noreferrer" />,
            <a href="https://maxroll.gg/wow/class-guides/fury-warrior-raid-guide" target="_blank" rel="noopener noreferrer" />,
          ]}
        </Trans>
      </p>
      <p>
        <Trans id="warrior.fury.rotation.description2" message="This should be used as a reference point for improvement when comparing against other logs. It does not cover the full set of priorites used by Simulationcraft/Raidbots (much like the written guides) as the list would be far too long and too complex to follow." />
      </p>
      <div>
        <Trans id="warrior.fury.rotation.potentialInaccuracy" message="Potential areas of inaccuracy:" />
        <ul>
          <li><Trans id="warrior.fury.rotation.inaccuracy1" message="Holding abilities for upcoming add spawns or damage amps" /></li>
          <li><Trans id="warrior.fury.rotation.inaccuracy2" message="Multiple targets" /></li>
          <li><Trans id="warrior.fury.rotation.inaccuracy3" message="Movement or periods of downtime" /></li>
        </ul>
      </div>
      <p>
        <strong><Trans id="warrior.fury.rotation.note" message="NOTE:" /></strong>{' '}
        <Trans id="warrior.fury.rotation.noteDescription" message="The priority list below does not include" />{' '}
        <SpellLink spell={TALENTS.REND_TALENT} icon />
      </p>
      <AplSectionData checker={AplCheck.check} apl={AplCheck.apl(info)} />
    </Section>
  );
}
