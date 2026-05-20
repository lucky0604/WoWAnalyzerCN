import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/monk';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SpellLink from 'interface/SpellLink';
import Combatant from 'parser/core/Combatant';
import { Apl } from 'parser/shared/metrics/apl';
import { Trans } from '@lingui/react/macro';
import {
  and,
  buffMissing,
  buffPresent,
  buffRemaining,
  describe,
  hasResource,
  hasTalent,
  or,
  spellCooldownRemaining,
} from 'parser/shared/metrics/apl/conditions';
import {
  aboutToCapEnergy,
  buildComboStrikesApl,
  danceOfChiJiExpiring,
  notAtTwoBlackoutKickStacks,
  notInZenithWithObsidianSpiral,
  optionalTouchOfDeath,
  whirlingDragonPunchReady,
} from './common';

const HEART_OF_THE_JADE_SERPENT_DURATION_MS = 10000;

const HEART_OF_THE_JADE_SERPENT_BUFFS = [
  SPELLS.HEART_OF_THE_JADE_SERPENT_BUFF,
  SPELLS.HEART_OF_THE_JADE_SERPENT_UNITY,
];

const activeHotJSMissing = () =>
  and(...HEART_OF_THE_JADE_SERPENT_BUFFS.map((spell) => buffMissing(spell)));

const activeHotJSRemaining = (range: { atLeast?: number; atMost?: number }) =>
  or(
    ...HEART_OF_THE_JADE_SERPENT_BUFFS.map((spell) =>
      buffRemaining(spell, HEART_OF_THE_JADE_SERPENT_DURATION_MS, range),
    ),
  );

const celestialConduitCastable = buffPresent(SPELLS.CELESTIAL_CONDUIT_CASTABLE_WW);

export default function conduitOfTheCelestialsApl(combatant: Combatant): Apl {
  return buildComboStrikesApl([
    {
      spell: TALENTS.FISTS_OF_FURY_TALENT,
      condition: describe(activeHotJSRemaining({ atMost: 1000 }), () => (
        <>
          <Trans id="monk.windwalker.apl.hotjs_remaining">
            <SpellLink spell={SPELLS.HEART_OF_THE_JADE_SERPENT_BUFF} /> has less than 1 second
            remaining
          </Trans>
        </>
      )),
    },
    {
      spell: SPELLS.TOUCH_OF_DEATH,
      condition: optionalTouchOfDeath,
    },
    {
      spell: TALENTS.CELESTIAL_CONDUIT_WINDWALKER_TALENT,
      condition: describe(and(activeHotJSMissing(), celestialConduitCastable), () => (
        <>
          <Trans id="monk.windwalker.apl.no_hotjs">
            no <SpellLink spell={SPELLS.HEART_OF_THE_JADE_SERPENT_BUFF} /> is active
          </Trans>
        </>
      )),
    },
    {
      spell: TALENTS.WHIRLING_DRAGON_PUNCH_TALENT,
      condition: whirlingDragonPunchReady,
    },
    {
      spell: SPELLS.TIGER_PALM,
      condition: describe(
        and(
          hasResource(RESOURCE_TYPES.CHI, { atMost: 3 }),
          notAtTwoBlackoutKickStacks,
          aboutToCapEnergy(combatant),
          notInZenithWithObsidianSpiral,
        ),
        () => (
          <>
            <Trans id="monk.windwalker.apl.tiger_palm_cap">
              you have less than 4 <SpellLink spell={RESOURCE_TYPES.CHI} />, fewer than 2 stacks of{' '}
              <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />, and are about to cap energy
            </Trans>
          </>
        ),
      ),
    },
    TALENTS.STRIKE_OF_THE_WINDLORD_TALENT,
    TALENTS.FISTS_OF_FURY_TALENT,
    {
      spell: SPELLS.RUSHING_WIND_KICK_CAST,
      condition: buffPresent(SPELLS.RUSHING_WIND_KICK_BUFF),
    },
    {
      spell: SPELLS.SPINNING_CRANE_KICK,
      condition: describe(
        and(danceOfChiJiExpiring, notAtTwoBlackoutKickStacks, notInZenithWithObsidianSpiral),
        () => (
          <>
            <Trans id="monk.windwalker.apl.sck_dance">
              <SpellLink spell={SPELLS.DANCE_OF_CHI_JI_BUFF} /> has less than 4 seconds remaining, and
              you have fewer than 2 stacks of <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />
            </Trans>
          </>
        ),
      ),
    },
    TALENTS.RISING_SUN_KICK_TALENT,
    TALENTS.ZENITH_STOMP_TALENT,
    {
      spell: SPELLS.TIGER_PALM,
      condition: describe(
        or(
          and(
            spellCooldownRemaining(TALENTS.STRIKE_OF_THE_WINDLORD_TALENT, { atMost: 1 }),
            hasResource(RESOURCE_TYPES.CHI, { atMost: 1 }),
          ),
          and(
            spellCooldownRemaining(TALENTS.FISTS_OF_FURY_TALENT, { atMost: 1 }),
            hasResource(RESOURCE_TYPES.CHI, { atMost: 2 }),
          ),
          and(
            hasTalent(TALENTS.RUSHING_WIND_KICK_WINDWALKER_TALENT),
            buffPresent(SPELLS.RUSHING_WIND_KICK_BUFF),
            spellCooldownRemaining(SPELLS.RUSHING_WIND_KICK_CAST, { atMost: 1 }),
            hasResource(RESOURCE_TYPES.CHI, { atMost: 1 }),
          ),
          and(danceOfChiJiExpiring, hasResource(RESOURCE_TYPES.CHI, { atMost: 1 })),
          and(
            spellCooldownRemaining(TALENTS.RISING_SUN_KICK_TALENT, { atMost: 1 }),
            hasResource(RESOURCE_TYPES.CHI, { atMost: 1 }),
          ),
        ),
        () => (
          <>
            <Trans id="monk.windwalker.apl.higher_priority_ready">
              a higher-priority chi spender is ready, and you do not have enough chi for it
            </Trans>
          </>
        ),
      ),
    },
    {
      spell: SPELLS.BLACKOUT_KICK,
      condition: describe(buffPresent(SPELLS.COMBO_BREAKER_BUFF), () => (
        <>
          <Trans id="monk.windwalker.apl.has_combo_breaker">
            you have <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />
          </Trans>
        </>
      )),
    },
    TALENTS.SLICING_WINDS_TALENT,
    {
      spell: SPELLS.SPINNING_CRANE_KICK,
      condition: buffPresent(SPELLS.DANCE_OF_CHI_JI_BUFF),
    },
    SPELLS.BLACKOUT_KICK,
    SPELLS.TIGER_PALM,
  ]);
}
