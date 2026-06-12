import SPELLS_COMMON from 'common/SPELLS';
import SPELLS from '../../spell-list_Monk_Brewmaster.retail';
import { suggestion } from 'parser/core/Analyzer';
import aplCheck, { Apl, build, CheckResult, PlayerInfo, tenseAlt } from 'parser/shared/metrics/apl';
import annotateTimeline from 'parser/shared/metrics/apl/annotate';
import * as cnd from 'parser/shared/metrics/apl/conditions';
import talents from 'common/TALENTS/monk';
import { AnyEvent } from 'parser/core/Events';
import { SpellLink, TooltipElement } from 'interface';
import { t } from '@lingui/core/macro';

const withCombo = cnd.buffPresent(SPELLS_COMMON.BLACKOUT_COMBO_BUFF);

const CHP_SETUP = {
  spell: talents.BREATH_OF_FIRE_TALENT,
  condition: cnd.optionalRule(
    cnd.and(
      cnd.hasTalent(talents.CHARRED_PASSIONS_TALENT),
      cnd.not(withCombo),
      cnd.buffMissing(SPELLS_COMMON.CHARRED_PASSIONS_BUFF, {
        duration: 8000,
        timeRemaining: 2000,
        pandemicCap: 1,
      }),
    ),
  ),
  description: (
    <>
      <TooltipElement
        content={
          <>
            <p>
              {t({ id: 'monk.brewmaster.apl.charred_passions_tooltip.p1', message: 'Applying ' })}
              <SpellLink spell={talents.CHARRED_PASSIONS_TALENT} />
              {t({ id: 'monk.brewmaster.apl.charred_passions_tooltip.p2', message: ' before using ' })}
              <SpellLink spell={SPELLS_COMMON.BLACKOUT_KICK_BRM} />
              {t({ id: 'monk.brewmaster.apl.charred_passions_tooltip.p3', message: ' can be a damage gain, but if you find yourself doing it too often it means you are missing ' })}
              <SpellLink spell={talents.BREATH_OF_FIRE_TALENT} />
              {t({ id: 'monk.brewmaster.apl.charred_passions_tooltip.p4', message: ' casts during your normal rotation.' })}
            </p>
            <p>
              {t({ id: 'monk.brewmaster.apl.charred_passions_tooltip.p5', message: 'You might run into this condition naturally when dealing with forced downtime, such as tank mechanics that require you to run away.' })}
            </p>
          </>
        }
      >
        {t({ id: 'monk.brewmaster.apl.optional', message: '(Optional)' })}
      </TooltipElement>{' '}
      <>
        {t({ id: 'monk.brewmaster.apl.apply_charred_passions.p1', message: 'Apply ' })}
        <SpellLink spell={talents.CHARRED_PASSIONS_TALENT} />
        {t({ id: 'monk.brewmaster.apl.apply_charred_passions.p2', message: ' when it is missing before using ' })}
        <SpellLink spell={SPELLS_COMMON.BLACKOUT_KICK_BRM} />
      </>
    </>
  ),
};

const standardApl = build([
  {
    spell: SPELLS.BREATH_OF_FIRE_TALENT,
    condition: cnd.describe(
      cnd.and(
        cnd.hasTalent(talents.WISDOM_OF_THE_WALL_TALENT),
        cnd.buffPresent(SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT),
      ),
      (tenseVal) => {
        const tense = tenseAlt(tenseVal, 'is', 'was');
        return (
          <>
            <SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Niuzao</SpellLink>
            {' '}{tense}{' '}
            {t({ id: 'monk.brewmaster.apl.niusao_active.p1', message: 'active (as ' })}
            <SpellLink spell={SPELLS.FLURRY_STRIKES_TALENT}>Shado-Pan</SpellLink>
            {t({ id: 'monk.brewmaster.apl.niusao_active.p2', message: ')' })}
          </>
        );
      },
    ),
  },
  {
    spell: SPELLS.KEG_SMASH_TALENT,
    condition: cnd.describe(
      cnd.and(
        cnd.hasTalent(talents.WISDOM_OF_THE_WALL_TALENT),
        cnd.buffPresent(SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT),
      ),
      (tenseVal) => {
        const tense = tenseAlt(tenseVal, 'is', 'was');
        return (
          <>
            <SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Niuzao</SpellLink>
            {' '}{tense}{' '}
            {t({ id: 'monk.brewmaster.apl.niusao_active_ks.p1', message: 'active (as ' })}
            <SpellLink spell={SPELLS.FLURRY_STRIKES_TALENT}>Shado-Pan</SpellLink>
            {t({ id: 'monk.brewmaster.apl.niusao_active_ks.p2', message: ')' })}
          </>
        );
      },
    ),
  },
  CHP_SETUP,
  SPELLS.BLACKOUT_KICK,
  {
    // special-case allowing BoF before Combo TP if doing so would
    // not violate a later rule (manually listed: currently just Empty Barrel check)
    // and would not delay your next BoK
    spell: SPELLS.BREATH_OF_FIRE_TALENT,
    condition: cnd.optionalRule(
      cnd.describe(
        cnd.and(
          withCombo,
          cnd.not(cnd.buffPresent(SPELLS_COMMON.EMPTY_BARREL_BUFF)),
          cnd.spellCooldownRemaining(SPELLS.BLACKOUT_KICK, { atLeast: 2000 }),
        ),
        (tense) => (
          <>
            {t({ id: 'monk.brewmaster.apl.combo_filler.p1', message: 'it ' })}
            {tenseAlt(tense, 'is', 'was')}
            {t({ id: 'monk.brewmaster.apl.combo_filler.p2', message: ' a correct ' })}
            <SpellLink spell={SPELLS.BLACKOUT_COMBO_TALENT}>Combo</SpellLink>
            {t({ id: 'monk.brewmaster.apl.combo_filler.p3', message: ' filler' })}
          </>
        ),
      ),
    ),
  },
  {
    spell: SPELLS.TIGER_PALM,
    condition: withCombo,
  },
  {
    spell: SPELLS.KEG_SMASH_TALENT,
    condition: cnd.buffPresent(SPELLS_COMMON.EMPTY_BARREL_BUFF),
  },
  {
    spell: SPELLS.KEG_SMASH_TALENT,
    condition: cnd.and(
      cnd.spellFractionalCharges(SPELLS.KEG_SMASH_TALENT, { atLeast: 1.8 }),
      cnd.hasTalent(talents.FLURRY_STRIKES_TALENT),
    ),
    description: (
      <>
        {t({ id: 'monk.brewmaster.apl.cast_keg_smash_charges.p1', message: 'Cast ' })}
        <SpellLink spell={SPELLS.KEG_SMASH_TALENT} />
        {t({ id: 'monk.brewmaster.apl.cast_keg_smash_charges.p2', message: ' at or near 2 charges (as ' })}
        <SpellLink spell={SPELLS.FLURRY_STRIKES_TALENT}>Shado-Pan</SpellLink>
        {t({ id: 'monk.brewmaster.apl.cast_keg_smash_charges.p3', message: ')' })}
      </>
    ),
  },
  SPELLS.BREATH_OF_FIRE_TALENT,
  SPELLS.KEG_SMASH_TALENT,
]);

export enum BrewmasterApl {
  Standard,
}

export const chooseApl = (_info: PlayerInfo): BrewmasterApl => {
  return BrewmasterApl.Standard;
};

const apls: Record<BrewmasterApl, Apl> = {
  [BrewmasterApl.Standard]: standardApl,
};

export const apl = (info: PlayerInfo): Apl => {
  return apls[chooseApl(info)];
};

export const check = (events: AnyEvent[], info: PlayerInfo): CheckResult => {
  const check = aplCheck(apl(info));
  return check(events, info);
};

export default suggestion((events, info) => {
  const { violations } = check(events, info);
  annotateTimeline(violations);

  return undefined;
});
