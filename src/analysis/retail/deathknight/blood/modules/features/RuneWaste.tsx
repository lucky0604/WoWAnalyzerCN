/**
 * This module uses a greatly simplified apl to check for rune waste (e.g. bad Marrowrend or Death's Caress casts).
 * @module
 */

import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/deathknight';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import ResourceLink from 'interface/ResourceLink';
import { Highlight } from 'interface/Highlight';

import SpellLink from 'interface/SpellLink';
import { useEvents, useInfo } from 'interface/guide';
import ViolationProblemList from 'interface/guide/components/Apl/violations';
import {
  ActualCastDescription,
  ViolationExplainer,
} from 'interface/guide/components/Apl/violations/claims';
import SuggestionBox from 'interface/suggestion-box/SuggestionBox';
import { AnyEvent } from 'parser/core/Events';
import aplCheck, {
  CheckResult,
  PlayerInfo,
  Violation,
  build,
  tenseAlt,
} from 'parser/shared/metrics/apl';
import * as cnd from 'parser/shared/metrics/apl/conditions';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { useMemo, type JSX } from 'react';

const RunicPowerColor = 'hsl(191, 60%, 50%)';

const boneShieldLow = (maxStacks: number) =>
  cnd.or(
    cnd.buffMissing(SPELLS.BONE_SHIELD, {
      timeRemaining: 4500,
      duration: 30000,
      pandemicCap: 1,
    }),
    cnd.buffStacks(SPELLS.BONE_SHIELD, { atMost: maxStacks }),
  );

const ossuaryCnd = cnd.describe(
  cnd.and(boneShieldLow(4), cnd.buffMissing(SPELLS.DANCING_RUNE_WEAPON_TALENT_BUFF)),
  (tense) => (
    <>
      <SpellLink spell={talents.OSSUARY_TALENT} />{' '}
      <Trans id="deathknight.blood.runeWaste.ossuaryInactive">
        {tenseAlt(tense, 'is', 'was')} inactive
      </Trans>
    </>
  ),
);

const exterminateCnd = cnd.describe(
  cnd.or(
    cnd.buffPresent(SPELLS.EXTERMINATE_BUFF),
    cnd.buffPresent(SPELLS.EXTERMINATE_PAINFUL_DEATH_BUFF),
  ),
  (tense) => (
    <>
      <SpellLink spell={talents.EXTERMINATE_TALENT} /> {tenseAlt(tense, 'is', 'was')}{' '}
      {t({ id: 'deathknight.blood.runeWaste.exterminateAvailable', message: 'available' })}
    </>
  ),
);

const runeRules = {
  marrowrend: {
    spell: talents.MARROWREND_TALENT,
    condition: ossuaryCnd,
  },
  exterminate: {
    spell: talents.MARROWREND_TALENT,
    condition: exterminateCnd,
  },
  soulReaper: {
    spell: talents.SOUL_REAPER_TALENT,
    condition: cnd.inExecute(0.35), // this should really get a custom condition for the case where you cast soul reaper and then it explodes below 35%, but that can only happen 1 time per target
  },
  deathsCaress: {
    spell: SPELLS.DEATHS_CARESS,
    condition: cnd.optionalRule(ossuaryCnd), // allow optionally using DC for BS refresh. i'm not here to litigate optimality. some high end people use DC for it a ton
  },
  vampiricStrike: {
    spell: SPELLS.VAMPIRIC_STRIKE,
    condition: cnd.buffPresent(SPELLS.VAMPIRIC_STRIKE_TRIGGER_BUFF),
  },
  drw: {
    soulReaper: {
      spell: talents.SOUL_REAPER_TALENT,
      condition: cnd.and(
        cnd.buffPresent(SPELLS.DANCING_RUNE_WEAPON_TALENT_BUFF),
        cnd.inExecute(0.35),
      ),
    },
    marrowrend: {
      // the guide includes this. it isn't strictly optimal under certain settings but we allow it
      spell: talents.MARROWREND_TALENT,
      condition: cnd.describe(
        cnd.optionalRule(
          cnd.and(
            cnd.buffPresent(SPELLS.DANCING_RUNE_WEAPON_TALENT_BUFF),
            // cheating with DRW duration because EVERYONE uses the same core talents
            cnd.buffRemaining(SPELLS.DANCING_RUNE_WEAPON_TALENT_BUFF, 16000, { atMost: 4500 }),
            // this condition prevents spamming it from passing muster
            cnd.buffRemaining(SPELLS.BONE_SHIELD, 30000, { atMost: 27000 }),
          ),
        ),
        (tense) => (
          <>
            <SpellLink spell={talents.DANCING_RUNE_WEAPON_TALENT} /> {tenseAlt(tense, 'is', 'was')}{' '}
            {t({ id: 'deathknight.blood.runeWaste.drwAboutToEnd', message: 'about to end to refresh ' })}
            <SpellLink spell={SPELLS.BONE_SHIELD} />
            {t({ id: 'deathknight.blood.runeWaste.drwAboutToEnd.p2', message: ' to max stacks' })}
          </>
        ),
      ),
    },

    marrowrendMissing: {
      spell: talents.MARROWREND_TALENT,
      condition: cnd.describe(
        cnd.and(cnd.buffPresent(SPELLS.DANCING_RUNE_WEAPON_TALENT_BUFF), boneShieldLow(1)),
        () => (
          <>
            <SpellLink spell={SPELLS.BONE_SHIELD} />
            {t({ id: 'deathknight.blood.runeWaste.boneShieldLowDuringDrw', message: ' is at 0 or 1 stacks during ' })}
            <SpellLink spell={talents.DANCING_RUNE_WEAPON_TALENT} />
          </>
        ),
      ),
    },
    vampiricStrike: {
      spell: SPELLS.VAMPIRIC_STRIKE,
      condition: cnd.buffPresent(SPELLS.GIFT_OF_THE_SANLAYN_BUFF),
    },
  },
};

const runePrio = build([
  runeRules.exterminate,
  // drw prio
  runeRules.drw.marrowrend,
  runeRules.drw.soulReaper,
  runeRules.drw.marrowrendMissing,
  runeRules.drw.vampiricStrike,
  {
    spell: talents.HEART_STRIKE_TALENT,
    condition: cnd.buffPresent(SPELLS.DANCING_RUNE_WEAPON_TALENT_BUFF),
  },
  // basic prio
  runeRules.deathsCaress,
  runeRules.marrowrend,
  runeRules.vampiricStrike,
  runeRules.soulReaper,
  talents.HEART_STRIKE_TALENT,
  SPELLS.DEATHS_CARESS,
]);

const check = aplCheck(runePrio);
function useRuneWasteProblems(events: AnyEvent[], info?: PlayerInfo) {
  const { successes, violations } = useMemo(
    (): Partial<CheckResult> => (info ? check(events, info) : {}),
    [events, info],
  );
  if (!successes || !violations) {
    return null;
  }

  return {
    claimData: boneShieldViolations(violations),
    result: { successes, violations },
    apl: runePrio,
  };
}

function boneShieldViolations(violations: Violation[]) {
  const resultSet = new Set<Violation>();
  for (const violation of violations) {
    if (
      violation.actualCast.ability.guid === talents.MARROWREND_TALENT.id ||
      violation.actualCast.ability.guid === SPELLS.DEATHS_CARESS.id
    ) {
      resultSet.add(violation);
    }
  }

  return {
    claims: resultSet,
    data: null,
  };
}

// oxlint-disable-next-line typescript/no-explicit-any
const DescribeBoneShieldWaste: ViolationExplainer<any>['describe'] = ({ violation }) => {
  const isMarrowrend = violation.actualCast.ability.guid === talents.MARROWREND_TALENT.id;
  return (
    <>
      <p>
        <ActualCastDescription event={violation.actualCast} />
        {t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.p1', message: ' when ' })}
        <SpellLink spell={SPELLS.BONE_SHIELD} />
        {t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.p2', message: ' was present and did not need to be refreshed.' })}
      </p>
      <p>
        {t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.p3', message: 'You could have generated ' })}
        <strong>{isMarrowrend ? 10 : 5}+</strong>
        {t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.p4', message: ' additional ' })}
        <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />
        {t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.p5', message: ' by casting ' })}
        <SpellLink spell={talents.HEART_STRIKE_TALENT} />
        {' '}{isMarrowrend ? t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.twice', message: 'twice' }) : ''}
        {t({ id: 'deathknight.blood.runeWaste.boneShieldWasteDescription.p6', message: ' instead.' })}
      </p>
    </>
  );
};

export function RuneWaste(): JSX.Element | null {
  const events = useEvents();
  const info = useInfo();
  const props = useRuneWasteProblems(events, info);

  const numSuccess = props?.result.successes.length;
  const numFailures = props?.result.violations.length;
  const boneShieldFailures = props?.claimData.claims.size;

  const perf = useMemo(() => {
    const ratio = (boneShieldFailures ?? 0) / ((numSuccess ?? 1) + (numFailures ?? 0));
    if (ratio < 0.05) {
      return QualitativePerformance.Good;
    } else if (ratio < 0.15) {
      return QualitativePerformance.Ok;
    } else {
      return QualitativePerformance.Fail;
    }
  }, [numSuccess, numFailures, boneShieldFailures]);

  if (!props) {
    return null;
  }

  return (
    <SuggestionBox
      performance={perf}
      title={
        <>
          <SpellLink spell={talents.HEART_STRIKE_TALENT} />
          {t({ id: 'deathknight.blood.runeWaste.heartStrikePrimaryRp', message: ' should be your primary source of RP.' })}
        </>
      }
      description={
        <>{t({ id: 'deathknight.blood.runeWaste.heartStrikeBonusRp.p1', message: 'Heart Strike generates a lot more' })}
          {' '}
          <Highlight textColor="#111" color={RunicPowerColor}>
            Bonus
          </Highlight>
          {' '}
          {t({ id: 'deathknight.blood.runeWaste.heartStrikeBonusRp.p2', message: 'RP than other abilities.' })}
        </>
      }
    >
      <div>
        <p>
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch', message: 'Using ' })}
          <SpellLink spell={talents.MARROWREND_TALENT} />
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.p2', message: ' too much is one of the most common problems. ' })}
          <SpellLink spell={talents.MARROWREND_TALENT} />
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.p3', message: ' generates less ' })}
          <ResourceLink id={RESOURCE_TYPES.RUNIC_POWER.id} />
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.p4', message: ' and does less damage per Rune than ' })}
          <SpellLink spell={talents.HEART_STRIKE_TALENT} />
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.p5', message: '. ' })}
          <SpellLink spell={talents.MARROWREND_TALENT} />
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.p6', message: ' should ' })}
          <em>{t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.only', message: 'only' })}</em>
          {t({ id: 'deathknight.blood.runeWaste.marrowrendTooMuch.p7', message: ' be used to apply and refresh ' })}
          <SpellLink spell={SPELLS.BONE_SHIELD} />!
        </p>
        <ViolationProblemList
          describer={DescribeBoneShieldWaste}
          {...props}
          orientation="column"
          secondsShown={9}
        />
      </div>
    </SuggestionBox>
  );
}
