import { t } from '@lingui/core/macro';
import { SubSection, useAnalyzer, useInfo } from 'interface/guide';
import { JSX } from 'react';
import Takedown from './Takedown';
import SpellLink from 'interface/SpellLink';
import TALENTS from 'common/TALENTS/hunter';
import SPELLS from 'common/SPELLS/hunter';
import { EventType } from 'parser/core/Events';
import Explanation from 'interface/guide/components/Explanation';
import CooldownGrid from 'interface/CooldownGrid/CooldownGrid';

const TIMELINE_LOOKBACK_MS = 3_000;

export default function TakedownSection(): JSX.Element | null {
  const takedown = useAnalyzer(Takedown);
  const info = useInfo();

  if (!takedown || !info) {
    return null;
  }

  if (!takedown.active) {
    return null;
  }

  const hasTwinFangs = info.combatant.hasTalent(TALENTS.TWIN_FANGS_TALENT);

  return (
    <SubSection title={<SpellLink spell={TALENTS.TAKEDOWN_TALENT} />}>
      <Explanation>
        {hasTwinFangs ? (
          <p>
            <>
              {t({
                id: 'hunter.survival.takedownSection.withTwinFangs.p1',
                message: 'With ',
              })}
              <SpellLink spell={TALENTS.TWIN_FANGS_TALENT} />
              {t({
                id: 'hunter.survival.takedownSection.withTwinFangs.p2',
                message: ', Takedown generates ',
              })}
              <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
              {t({
                id: 'hunter.survival.takedownSection.withTwinFangs.p3',
                message: ' stacks on its own. Aim to enter Takedown with 0 stacks to maximise effectiveness of Twin Fangs.',
              })}
            </>
          </p>
        ) : (
          <p>
            <>
              {t({
                id: 'hunter.survival.takedownSection.withoutTwinFangs.p1',
                message: 'Without ',
              })}
              <SpellLink spell={TALENTS.TWIN_FANGS_TALENT} />
              {t({
                id: 'hunter.survival.takedownSection.withoutTwinFangs.p2',
                message: ', Takedown does not generate ',
              })}
              <SpellLink spell={SPELLS.TIP_OF_THE_SPEAR_CAST} />
              {t({
                id: 'hunter.survival.takedownSection.withoutTwinFangs.p3',
                message: ' stacks on its own. Use ',
              })}
              <SpellLink spell={TALENTS.KILL_COMMAND_SURVIVAL_TALENT} />
              {t({
                id: 'hunter.survival.takedownSection.withoutTwinFangs.p4',
                message: ' before Takedown to maximise stacks during Takedown.',
              })}
            </>
          </p>
        )}
      </Explanation>
      <CooldownGrid
        label={<SpellLink spell={TALENTS.TAKEDOWN_TALENT} />}
        timeline={{
          cooldowns: [TALENTS.KILL_COMMAND_SURVIVAL_TALENT, TALENTS.WILDFIRE_BOMB_TALENT],
        }}
        table={{
          type: EventType.Damage,
        }}
        items={takedown.takedownCasts.map((cast) => {
          const { perf, checklist } = takedown.checklist(cast);
          return {
            perf,
            checklistItems: checklist,
            range: {
              start: cast.castEvent.timestamp - TIMELINE_LOOKBACK_MS,
              end: cast.windowEnd,
            },
          };
        })}
      />
    </SubSection>
  );
}
