import type { JSX } from 'react';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellLink } from 'interface';
import { TipBox } from 'interface/guide/components';
import { MistweaverApl } from './AplCheck';
import { t } from '@lingui/core/macro';

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
    <>
      <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />
      {t({ id: 'monk.mistweaver.apl.jadefire_teachings_desc.p1', message: ' to extend HoTs and convert damage to healing through ' })}
      <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />
      {t({ id: 'monk.mistweaver.apl.jadefire_teachings_desc.p2', message: ', ' })}
      <SpellLink spell={SPELLS.BLACKOUT_KICK} />
      {t({ id: 'monk.mistweaver.apl.jadefire_teachings_desc.p3', message: ', ' })}
      <SpellLink spell={SPELLS.TIGER_PALM} />
      {t({ id: 'monk.mistweaver.apl.jadefire_teachings_desc.p4', message: ', and ' })}
      <SpellLink spell={SPELLS.CRACKLING_JADE_LIGHTNING} />
      {t({ id: 'monk.mistweaver.apl.jadefire_teachings_desc.p5', message: '.' })}
    </>
  );
};

const RushingWindKickDescription = () => {
  return (
    <>
      <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} />
      {t({ id: 'monk.mistweaver.apl.rushing_wind_kick_desc.p1', message: ' to extend your active HoTs, building up high counts of ' })}
      <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
      {t({ id: 'monk.mistweaver.apl.rushing_wind_kick_desc.p2', message: '. This sets up ' })}
      <SpellLink spell={SPELLS.VIVIFY} />
      {t({ id: 'monk.mistweaver.apl.rushing_wind_kick_desc.p3', message: ' to deal increasingly stronger ' })}
      <SpellLink spell={talents.INVIGORATING_MISTS_TALENT} />
      {t({ id: 'monk.mistweaver.apl.rushing_wind_kick_desc.p4', message: ' healing the more ' })}
      <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
      {t({ id: 'monk.mistweaver.apl.rushing_wind_kick_desc.p5', message: 's you have active.' })}
    </>
  );
};

const ThunderFocusTeaRem = () => {
  return (
    <><SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} />
      {t({ id: 'monk.mistweaver.apl.tft_rem.p1', message: 'is primarily used on' })}
      {' '}
      <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
      {t({ id: 'monk.mistweaver.apl.tft_rem.p2', message: 'with this build.' })}
    </>
  );
};

const ThunderFocusTeaRemRsk = () => {
  return (
    <><SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} />
      {t({ id: 'monk.mistweaver.apl.tft_rem_rsk.p1', message: 'can be used with both' })}
      {' '}
      <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
      {t({ id: 'monk.mistweaver.apl.tft_rem_rsk.p2', message: 'and' })}
      {' '}
      <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />
      {t({ id: 'monk.mistweaver.apl.tft_rem_rsk.p3', message: 'with this build.' })}
    </>
  );
};

const RisingMistJadefireTeachingsDescription = () => {
  return (
    <>
      <p>
        {t({ id: 'monk.mistweaver.apl.rotation_uses', message: 'This rotation uses ' })}
        <JadefireTeachingsDescription />
      </p>
      <p>
        <>{t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p1', message: 'When playing ' })}
          <SpellLink spell={talents.RISING_MIST_TALENT} />
          {t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p2', message: 'and' })}
          {' '}
          <SpellLink spell={talents.JADEFIRE_TEACHINGS_TALENT} />
          {t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p3', message: 'with' })}
          {' '}
          <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />
          {t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p4', message: 'as often as possible, and cast' })}
          {' '}
          <SpellLink spell={talents.JADEFIRE_STOMP_TALENT} />
          {t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p5', message: 'or' })}
          {' '}
          <SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} />
          {t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p6', message: 'as often as necessary to maintain the ' })}
          <SpellLink spell={talents.JADEFIRE_TEACHINGS_TALENT} />
          {t({ id: 'monk.mistweaver.apl.rising_mist_jadefire_teachings_shao_pan.p7', message: 'buff.' })}
        </>
        <ThunderFocusTeaRemRsk />
      </p>
    </>
  );
};

const RisingMistRushingWindKickDescription = () => {
  return (
    <>
      <p>
        {t({ id: 'monk.mistweaver.apl.rotation_uses', message: 'This rotation uses ' })}
        <RushingWindKickDescription />
      </p>
      <p>
        {t({ id: 'monk.mistweaver.apl.rising_mist_rushing_wind_kick_shao_pan.p1', message: 'When playing ' })}
        <SpellLink spell={talents.RISING_MIST_TALENT} />
        {t({ id: 'monk.mistweaver.apl.rising_mist_rushing_wind_kick_shao_pan.p2', message: ' with ' })}
        <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} />
        {t({ id: 'monk.mistweaver.apl.rising_mist_rushing_wind_kick_shao_pan.p3', message: ', keep ' })}
        <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
        {t({ id: 'monk.mistweaver.apl.rising_mist_rushing_wind_kick_shao_pan.p4', message: ' on cooldown and cast ' })}
        <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} />
        {t({ id: 'monk.mistweaver.apl.rising_mist_rushing_wind_kick_shao_pan.p5', message: ' as often as possible.' })}
        <ThunderFocusTeaRem />
      </p>
    </>
  );
};

const CleaveBuildNotYetSupportedDescription = () => {
  return (
    <TipBox type="warning">
      {t({ id: 'monk.mistweaver.apl.way_of_the_crane_not_supported.p1', message: 'The ' })}
      <SpellLink spell={talents.WAY_OF_THE_CRANE_TALENT} />
      {t({ id: 'monk.mistweaver.apl.way_of_the_crane_not_supported.p2', message: ' rotation is not currently supported.' })}
    </TipBox>
  );
};

const TomDescription = () => {
  return (
    <TipBox type="warning">
      {t({ id: 'monk.mistweaver.apl.tear_of_morning_not_supported.p1', message: 'The ' })}
      <SpellLink spell={talents.TEAR_OF_MORNING_TALENT} />
      {t({ id: 'monk.mistweaver.apl.tear_of_morning_not_supported.p2', message: ' rotation is not currently supported.' })}
    </TipBox>
  );
};

const FallbackDescription = () => {
  return (
    <>
      <p>
        {t({ id: 'monk.mistweaver.apl.fallback.p1', message: 'The ' })}
        {aplTitle(MistweaverApl.Fallback)}
        {t({ id: 'monk.mistweaver.apl.fallback.p2', message: " rotation is used when you aren't using a recommended raid build. Regardless of talent choices it is still important for you to follow the core priority: high mana efficient spells and short cooldowns, then filler damage spells. This is the simplest rotation, but practicing it will build good habits that work with the other variations." })}
      </p>
    </>
  );
};

const Description = ({ aplChoice }: { aplChoice: MistweaverApl }) => {
  switch (aplChoice) {
    case MistweaverApl.RisingMistJadefireTeachings:
      return <RisingMistJadefireTeachingsDescription />;
    case MistweaverApl.RisingMistRushingWindKick:
      return <RisingMistRushingWindKickDescription />;
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
        <>{t({ id: 'monk.mistweaver.apl.mw_core_explanation.p1', message: 'Mistweavers have a few different variations to their core rotation, depending on your talent selection. The core of the rotations does not change with' })}
          {' '}
          <SpellLink spell={SPELLS.RENEWING_MIST_CAST} />
          {t({ id: 'monk.mistweaver.apl.mw_core_explanation.p2', message: ',' })}
          {' '}
          <SpellLink spell={talents.RISING_SUN_KICK_TALENT} />
          {t({ id: 'monk.mistweaver.apl.mw_core_explanation.p3', message: '/ ' })}
          <SpellLink spell={talents.RUSHING_WIND_KICK_MISTWEAVER_TALENT} />
          {t({ id: 'monk.mistweaver.apl.mw_core_explanation.p4', message: ', and' })}
          {' '}
          <SpellLink spell={talents.THUNDER_FOCUS_TEA_TALENT} />
          {t({ id: 'monk.mistweaver.apl.mw_core_explanation.p5', message: 'always being the top priority abilities.' })}
        </>
      </p>
      <hr />
      <p>
        <strong>
          {t({ id: 'monk.mistweaver.apl.selected_build', message: 'Selected Build:' })}
        </strong>{' '}
        {aplTitle(aplChoice)}
      </p>
      <Description aplChoice={aplChoice} />
    </>
  );
}
