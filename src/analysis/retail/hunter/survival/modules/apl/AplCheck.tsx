import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/hunter';
import { Section, useInfo } from 'interface/guide';
import { AplSectionData } from 'interface/guide/components/Apl';
import SpellLink from 'interface/SpellLink';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import Analyzer from 'parser/core/Analyzer';
import { AnyEvent } from 'parser/core/Events';
import aplCheck, {
  Apl,
  build,
  CheckResult,
  PlayerInfo,
  Rule,
  Violation,
} from 'parser/shared/metrics/apl';
import {
  and,
  buffPresent,
  buffMissing,
  buffStacks,
  debuffPresent,
  debuffMissing,
  or,
  spellFractionalCharges,
} from 'parser/shared/metrics/apl/conditions';
import {
  AplViolationExplainers,
  defaultExplainers,
} from 'interface/guide/components/Apl/violations/claims';

const sentinelRules: Rule[] = [
  {
    spell: TALENTS.KILL_COMMAND_SURVIVAL_TALENT,
    condition: buffMissing(SPELLS.TIP_OF_THE_SPEAR_CAST),
  },
  {
    spell: TALENTS.BOOMSTICK_TALENT,
    condition: debuffMissing(SPELLS.SENTINELS_MARK_DEBUFF),
    description: (
      <>
        <Trans id="hunter.survival.apl.sentinelBoomstick.p1">Cast </Trans>
        <SpellLink spell={TALENTS.BOOMSTICK_TALENT} />
        <Trans id="hunter.survival.apl.sentinelBoomstick.p2"> if </Trans>
        <SpellLink spell={SPELLS.SENTINELS_MARK_DEBUFF} />
        <Trans id="hunter.survival.apl.sentinelBoomstick.p3"> is not present.</Trans>
      </>
    ),
  },
  {
    spell: TALENTS.WILDFIRE_BOMB_TALENT,
    condition: or(
      debuffPresent(SPELLS.SENTINELS_MARK_DEBUFF),
      spellFractionalCharges(TALENTS.WILDFIRE_BOMB_TALENT, { atLeast: 1.7 }),
    ),
    description: (
      <>
        <Trans id="hunter.survival.apl.sentinelWildfireBomb.p1">Cast </Trans>
        <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} />
        <Trans id="hunter.survival.apl.sentinelWildfireBomb.p2"> if </Trans>
        <SpellLink spell={SPELLS.SENTINELS_MARK_DEBUFF} />
        <Trans id="hunter.survival.apl.sentinelWildfireBomb.p3"> is present or you are about to cap charges.</Trans>
      </>
    ),
  },
  {
    spell: TALENTS.TAKEDOWN_TALENT,
    condition: buffMissing(SPELLS.TIP_OF_THE_SPEAR_CAST),
    description: (
      <>
        <Trans id="hunter.survival.apl.sentinelTakedown.p1">Cast </Trans>
        <SpellLink spell={TALENTS.TAKEDOWN_TALENT} />
        <Trans id="hunter.survival.apl.sentinelTakedown.p2"> if </Trans>
        <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
        <Trans id="hunter.survival.apl.sentinelTakedown.p3"> is not present.</Trans>
      </>
    ),
  },
  SPELLS.MOONLIGHT_CHAKRAM_CAST,
  {
    spell: SPELLS.RAPTOR_SWIPE_DAMAGE,
    condition: buffPresent(SPELLS.RAPTOR_SWIPE_BUFF),
    description: (
      <>
        <Trans id="hunter.survival.apl.sentinelRaptorSwipe.p1">Cast </Trans>
        <SpellLink spell={SPELLS.RAPTOR_SWIPE_DAMAGE} />
      </>
    ),
  },
  TALENTS.RAPTOR_STRIKE_TALENT,
  {
    spell: SPELLS.HATCHET_TOSS,
    description: (
      <>
        <Trans id="hunter.survival.apl.neverCastHatchetToss.p1">Never cast </Trans>
        <SpellLink spell={SPELLS.HATCHET_TOSS} />
        <Trans id="hunter.survival.apl.neverCastHatchetToss.p2">.</Trans>
      </>
    ),
  },
];

const packLeaderRules: Rule[] = [
  {
    spell: TALENTS.KILL_COMMAND_SURVIVAL_TALENT,
    condition: or(
      buffMissing(SPELLS.TIP_OF_THE_SPEAR_CAST),
      and(
        buffMissing(SPELLS.HOWL_OF_THE_PACKLEADER_BUFF),
        buffStacks(SPELLS.TIP_OF_THE_SPEAR_CAST, { atMost: 1 }),
      ),
    ),
    description: (
      <>
        <Trans id="hunter.survival.apl.packLeaderKillCommand.p1">Cast </Trans>
        <SpellLink spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT} />
        <Trans id="hunter.survival.apl.packLeaderKillCommand.p2"> if </Trans>
        <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
        <Trans id="hunter.survival.apl.packLeaderKillCommand.p3"> is missing, or if </Trans>
        <SpellLink spell={SPELLS.HOWL_OF_THE_PACKLEADER_BUFF} />
        <Trans id="hunter.survival.apl.packLeaderKillCommand.p4"> is ready and Tip is at 0-1 stacks.</Trans>
      </>
    ),
  },
  {
    spell: TALENTS.TAKEDOWN_TALENT,
    condition: buffMissing(SPELLS.TIP_OF_THE_SPEAR_CAST),
    description: (
      <>
        <Trans id="hunter.survival.apl.packLeaderTakedown.p1">Cast </Trans>
        <SpellLink spell={TALENTS.TAKEDOWN_TALENT} />
        <Trans id="hunter.survival.apl.packLeaderTakedown.p2"> if no stacks of </Trans>
        <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
        <Trans id="hunter.survival.apl.packLeaderTakedown.p3"> to maximise Twin Fangs.</Trans>
      </>
    ),
  },
  TALENTS.BOOMSTICK_TALENT,
  {
    spell: TALENTS.WILDFIRE_BOMB_TALENT,
    condition: and(
      buffPresent(SPELLS.WYVERNS_CRY),
      spellFractionalCharges(TALENTS.WILDFIRE_BOMB_TALENT, { atLeast: 1 }),
    ),
    description: (
      <>
        <Trans id="hunter.survival.apl.packLeaderWildfireBomb.p1">Cast </Trans>
        <SpellLink spell={TALENTS.WILDFIRE_BOMB_TALENT} />
        <Trans id="hunter.survival.apl.packLeaderWildfireBomb.p2"> if </Trans>
        <SpellLink spell={SPELLS.HOWL_WYVERN_BUFF} />
        <Trans id="hunter.survival.apl.packLeaderWildfireBomb.p3"> can be extended.</Trans>
      </>
    ),
  },
  {
    spell: SPELLS.RAPTOR_SWIPE_DAMAGE,
    condition: buffPresent(SPELLS.RAPTOR_SWIPE_BUFF),
  },
  TALENTS.RAPTOR_STRIKE_TALENT,
  TALENTS.KILL_COMMAND_SURVIVAL_TALENT,
  TALENTS.WILDFIRE_BOMB_TALENT,
  TALENTS.TAKEDOWN_TALENT,
  {
    spell: SPELLS.HATCHET_TOSS,
    description: (
      <>
        <Trans id="hunter.survival.apl.neverCastHatchetToss.p1">Never cast </Trans>
        <SpellLink spell={SPELLS.HATCHET_TOSS} />
        <Trans id="hunter.survival.apl.neverCastHatchetToss.p2">.</Trans>
      </>
    ),
  },
];

export const apl = (info: PlayerInfo): Apl => {
  if (info.combatant.hasTalent(TALENTS.MOONLIGHT_CHAKRAM_TALENT)) {
    return build(sentinelRules);
  }

  return build(packLeaderRules);
};

export const check = (events: AnyEvent[], info: PlayerInfo): CheckResult => {
  const check = aplCheck(apl(info));
  return check(events, info);
};

function KillCommandTipStackNote({ violation }: { violation: Violation }) {
  const info = useInfo();
  if (violation.actualCast.ability.guid !== TALENTS.KILL_COMMAND_SURVIVAL_TALENT.id) {
    return null;
  }

  const tipStacksOnCast = info?.combatant?.getBuffStacks(
    SPELLS.TIP_OF_THE_SPEAR_CAST.id,
    violation.actualCast.timestamp,
  );
  if (tipStacksOnCast === undefined) {
    return null;
  }

  return (
    <p>
      <>
        {t({
          id: 'hunter.survival.apl.tipStacksOnCast.p1',
          message: 'Tip of the Spear stacks on cast: ',
        })}
        <strong>{tipStacksOnCast}</strong>
      </>
    </p>
  );
}

const droppedRuleWithTip: typeof defaultExplainers.droppedRule = {
  ...defaultExplainers.droppedRule,
  describe: (props) => (
    <>
      {defaultExplainers.droppedRule.describe(props)}
      <KillCommandTipStackNote violation={props.violation} />
    </>
  ),
};

const survivalExplainers: AplViolationExplainers = {
  ...defaultExplainers,
  droppedRule: droppedRuleWithTip,
};

export function AplSection() {
  const info = useInfo();
  if (!info) {
    return null;
  }

  return (
    <Section
      title={t({
        id: 'hunter.survival.apl.title',
        message: 'Action Priority List',
      })}
    >
      <p>
        <Trans id="hunter.survival.apl.description">
          The general priority for Survival Hunter is to ensure every ability is tipped and that
          major rotational cooldowns are used before filler. The APL Checker cannot account for every
          situation in a fight, so use this as a general guideline rather than a strict rule-set. For
          example, normal priority is to use Boomstick on cooldown but if the fight is going to end
          before you can get two more uses out of it, ie in less than 1.5 minutes then you can hold
          Boomstick to use during Takedown's 20% damage amp for a DPS gain as holding it won't result
          in a lost use like it would in a longer fight.
        </Trans>
      </p>
      <AplSectionData checker={check} apl={apl(info)} violationExplainers={survivalExplainers} />
    </Section>
  );
}

export default class AplCheck extends Analyzer {}
