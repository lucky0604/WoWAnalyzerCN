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
import { Trans } from '@lingui/react/macro';

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
              <Trans id="monk.brewmaster.apl.charred_passions_tooltip.p1">Applying </Trans>
              <SpellLink spell={talents.CHARRED_PASSIONS_TALENT} />
              <Trans id="monk.brewmaster.apl.charred_passions_tooltip.p2"> before using </Trans>
              <SpellLink spell={SPELLS_COMMON.BLACKOUT_KICK_BRM} />
              <Trans id="monk.brewmaster.apl.charred_passions_tooltip.p3"> can be a damage gain, but if you find yourself doing it too often it means you are missing </Trans>
              <SpellLink spell={talents.BREATH_OF_FIRE_TALENT} />
              <Trans id="monk.brewmaster.apl.charred_passions_tooltip.p4"> casts during your normal rotation.</Trans>
            </p>
            <p>
              <Trans id="monk.brewmaster.apl.charred_passions_tooltip.p5">You might run into this condition naturally when dealing with forced downtime, such as tank mechanics that require you to run away.</Trans>
            </p>
          </>
        }
      >
        <Trans id="monk.brewmaster.apl.optional">(Optional)</Trans>
      </TooltipElement>{' '}
      <>
        <Trans id="monk.brewmaster.apl.apply_charred_passions.p1">Apply </Trans>
        <SpellLink spell={talents.CHARRED_PASSIONS_TALENT} />
        <Trans id="monk.brewmaster.apl.apply_charred_passions.p2"> when it is missing before using </Trans>
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
        <Trans id="monk.brewmaster.apl.cast_keg_smash_charges.p1">Cast </Trans>
        <SpellLink spell={SPELLS.KEG_SMASH_TALENT} />
        <Trans id="monk.brewmaster.apl.cast_keg_smash_charges.p2"> at or near 2 charges (as </Trans>
        <SpellLink spell={SPELLS.FLURRY_STRIKES_TALENT}>Shado-Pan</SpellLink>
        <Trans id="monk.brewmaster.apl.cast_keg_smash_charges.p3">)</Trans>
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
