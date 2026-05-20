import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellLink } from 'interface';
import { MistweaverApl } from './AplCheck';
import { Trans } from '@lingui/react/macro';

const aplTitle = (choice: MistweaverApl) => {
  switch (choice) {
    case MistweaverApl.RisingMistJadefireTeachings:
      return (
        <>
          <SpellLink spell={talents.RISING_MIST_TALENT} /> /{' '}
          <SpellLink spell={talents.JADEFIRE_TEACHINGS_TALENT} />{' '}
        </>
      );
    case MistweaverApl.RisingMistRushingWindKick:
      return (
        <>
          <SpellLink spell={talents.RISING_MIST_TALENT} /> /{' '}
          <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} />{' '}
        </>
      );
    case MistweaverApl.WayOfTheCrane:
      return (
        <>
          <SpellLink spell={talents.WAY_OF_THE_CRANE_TALENT} />
        </>
      );
    case MistweaverApl.TearOfMorning:
      return (
        <>
          <SpellLink spell={talents.TEAR_OF_MORNING_TALENT} />
        </>
      );
    default:
      return <em>Fallback</em>;
  }
};

const JadefireTeachingsDescription = () => {
  return (
    <Trans id="monk.mistweaver.apl.jadefire_teachings_desc">
      <SpellLink spell={talents.RISING_SUN_KICK_TALENT} /> to extend hots and convert damage to
      healing through <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />,{' '}
      <SpellLink spell={SPELLS.BLACKOUT_KICK} />, <SpellLink spell={SPELLS.TIGER_PALM} />, and{' '}
      <SpellLink spell={SPELLS.CRACKLING_JADE_LIGHTNING} />.
    </Trans>
  );
};

const RushingWindKickDescription = () => {
  return (
    <Trans id="monk.mistweaver.apl.rushing_wind_kick_desc">
      <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} /> to extend hots to accrue
      high counts of <SpellLink spell={SPELLS.RENEWING_MIST_CAST} /> and amplify their healing.
    </Trans>
  );
};

const ThunderFocusTeaRem = () => {
  return (
    <Trans id="monk.mistweaver.apl.tft_rem">
      <SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} /> is primarily used on{' '}
      <SpellLink spell={SPELLS.RENEWING_MIST_CAST} /> with this build.
    </Trans>
  );
};

const ThunderFocusTeaRemRsk = () => {
  return (
    <Trans id="monk.mistweaver.apl.tft_rem_rsk">
      <SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} /> can be used with both{' '}
      <SpellLink spell={SPELLS.RENEWING_MIST_CAST} /> and{' '}
      <SpellLink spell={talents.RISING_SUN_KICK_TALENT} /> with this build.
    </Trans>
  );
};

const RisingMistJadefireTeachingsShaohaosDescription = () => {
  return (
    <>
      <p>
        The {aplTitle(MistweaverApl.RisingMistJadefireTeachings)} rotation uses{' '}
        <JadefireTeachingsDescription />
      </p>
      <p>
        <Trans id="monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan">
          When playing <SpellLink spell={talents.RISING_MIST_TALENT} /> and{' '}
          <SpellLink spell={talents.JADEFIRE_TEACHINGS_TALENT} /> with{' '}
          <SpellLink spell={talents.RISING_SUN_KICK_TALENT} /> as often as possible, and cast{' '}
          <SpellLink spell={talents.JADEFIRE_STOMP_TALENT} /> or{' '}
          <SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} /> as often as necessary to maintain the{' '}
          <SpellLink spell={talents.JADEFIRE_TEACHINGS_TALENT} /> buff.
        </Trans>
        <ThunderFocusTeaRemRsk />
      </p>
    </>
  );
};

const RisingMistRushingWindKickShaohaosDescription = () => {
  return (
    <>
      <p>
        The {aplTitle(MistweaverApl.RisingMistRushingWindKick)} rotation uses{' '}
        <RushingWindKickDescription />
      </p>
      <Trans id="monk.mistweaver.apl.rising_mist_rushing_wind_kick_shao_pan">
        When playing <SpellLink spell={talents.RISING_MIST_TALENT} /> with{' '}
        <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} /> and{' '}
        <SpellLink spell={SPELLS.RENEWING_MIST_CAST} /> on cooldown and cast{' '}
        <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} /> as often as possible.{' '}
      </Trans>
      <ThunderFocusTeaRem />
    </>
  );
};

const CleaveBuildNotYetSupportedDescription = () => {
  return (
    <>
      <p>
        <strong>
          <Trans id="monk.mistweaver.apl.way_of_the_crane_not_supported">
            The <SpellLink spell={talents.WAY_OF_THE_CRANE_TALENT} /> rotation is not currently
            supported.
          </Trans>
        </strong>
      </p>
    </>
  );
};

const TomDescription = () => {
  return (
    <>
      <p>
        <strong>
          <Trans id="monk.mistweaver.apl.tear_of_morning_not_supported">
            The <SpellLink spell={talents.TEAR_OF_MORNING_TALENT} /> rotation is not currently
            supported.
          </Trans>
        </strong>
      </p>
    </>
  );
};

const FallbackDescription = () => {
  return (
    <>
      <p>
        <Trans id="monk.mistweaver.apl.fallback">
          The {aplTitle(MistweaverApl.Fallback)} rotation is used when you aren't using a recommended
          raid build. Regardless of talent choices it is still important for you to follow the core
          priority: high mana efficient spells and short cooldowns, then filler damage spells. This is
          the simplest rotation, but practicing it will build good habits that work with the other
          variations.
        </Trans>
      </p>
    </>
  );
};

const Description = ({ aplChoice }: { aplChoice: MistweaverApl }) => {
  switch (aplChoice) {
    case MistweaverApl.RisingMistJadefireTeachings:
      return <RisingMistJadefireTeachingsShaohaosDescription />;
    case MistweaverApl.RisingMistRushingWindKick:
      return <RisingMistRushingWindKickShaohaosDescription />;
    case MistweaverApl.WayOfTheCrane:
      return <CleaveBuildNotYetSupportedDescription />;
    case MistweaverApl.TearOfMorning:
      return <TomDescription />;
    default:
      return <FallbackDescription />;
  }
};

export default function AplChoiceDescription({
  aplChoice,
}: {
  aplChoice: MistweaverApl;
}): JSX.Element {
  return (
    <>
      <p>
        <Trans id="monk.mistweaver.apl.mw_core_explanation">
          Mistweavers have a few different variations to their core rotation, depending on your talent
          selection. The core of the rotations does not change with{' '}
          <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />,{' '}
          <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />/
          <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} />, and{' '}
          <SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} /> always being the top priority
          abilities.
        </Trans>
      </p>
      <p>
        <strong>
          <Trans id="monk.mistweaver.apl.selected_build">Selected Build:</Trans>
        </strong> {aplTitle(aplChoice)}
      </p>
      <Description aplChoice={aplChoice} />
    </>
  );
}
