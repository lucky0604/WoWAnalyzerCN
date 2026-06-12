import SPELLS from 'common/SPELLS';
import TALENTS from 'common/TALENTS/monk';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import SpellLink from 'interface/SpellLink';
import Combatant from 'parser/core/Combatant';
import { Apl } from 'parser/shared/metrics/apl';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  and,
  buffPresent,
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

export default function shadoPanApl(combatant: Combatant): Apl {
  return buildComboStrikesApl([
    {
      spell: SPELLS.TOUCH_OF_DEATH,
      condition: optionalTouchOfDeath,
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
            {t({
              id: 'monk.windwalker.apl.tiger_palm_cap.p1',
              message: 'you have less than 4 ',
            })}
            <SpellLink spell={RESOURCE_TYPES.CHI} />
            {t({
              id: 'monk.windwalker.apl.tiger_palm_cap.p2',
              message: ', fewer than 2 stacks of ',
            })}
            <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />
            {t({
              id: 'monk.windwalker.apl.tiger_palm_cap.p3',
              message: ', and are about to cap energy',
            })}
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
            <SpellLink spell={SPELLS.DANCE_OF_CHI_JI_BUFF} />
            {t({
              id: 'monk.windwalker.apl.sck_dance.p1',
              message: ' has less than 4 seconds remaining, and you have fewer than 2 stacks of ',
            })}
            <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />
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
            notInZenithWithObsidianSpiral,
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
      condition: describe(
        or(buffPresent(SPELLS.COMBO_BREAKER_BUFF), buffPresent(TALENTS.ZENITH_TALENT)),
        () => (
          <>
            {t({
              id: 'monk.windwalker.apl.has_cb_or_zenith.p1',
              message: 'you have ',
            })}
            <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />
            {t({
              id: 'monk.windwalker.apl.has_cb_or_zenith.p2',
              message: ' or ',
            })}
            <SpellLink spell={TALENTS.ZENITH_TALENT} />
            {t({
              id: 'monk.windwalker.apl.has_cb_or_zenith.p3',
              message: ' is active',
            })}
          </>
        ),
      ),
    },
    {
      spell: SPELLS.SPINNING_CRANE_KICK,
      condition: describe(
        and(buffPresent(TALENTS.ZENITH_TALENT), hasResource(RESOURCE_TYPES.CHI, { atLeast: 4 })),
        () => (
          <>
            <SpellLink spell={TALENTS.ZENITH_TALENT} />
            {t({
              id: 'monk.windwalker.apl.zenith_sck.p1',
              message: ' is active and you have more than 3 ',
            })}
            <SpellLink spell={RESOURCE_TYPES.CHI} />
          </>
        ),
      ),
    },
    TALENTS.SLICING_WINDS_TALENT,
    {
      spell: SPELLS.SPINNING_CRANE_KICK,
      condition: buffPresent(SPELLS.DANCE_OF_CHI_JI_BUFF),
    },
    SPELLS.BLACKOUT_KICK,
    SPELLS.SPINNING_CRANE_KICK,
    SPELLS.TIGER_PALM,
  ]);
}
