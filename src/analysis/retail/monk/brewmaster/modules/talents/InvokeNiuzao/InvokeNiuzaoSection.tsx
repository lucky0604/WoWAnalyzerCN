import { SubSection, useAnalyzer, useInfo } from 'interface/guide';
import { JSX } from 'react';
import InvokeNiuzao from './InvokeNiuzao';
import SpellLink from 'interface/SpellLink';
import SPELLS from '../../../spell-list_Monk_Brewmaster.retail';
import SPELLS_COMMON from 'common/SPELLS';
import { EventType } from 'parser/core/Events';
import Explanation from 'interface/guide/components/Explanation';
import CooldownGrid from 'interface/CooldownGrid/CooldownGrid';
import { t } from '@lingui/core/macro';

export default function InvokeNiuzaoSection(): JSX.Element | null {
  const invoke = useAnalyzer(InvokeNiuzao);
  const info = useInfo();

  if (!invoke || !info) {
    return null;
  }

  if (!invoke.active) {
    return null;
  }

  return (
    <SubSection title={<SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT} />}>
      <Explanation>
        <p>
          <>
            <SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Invoke Niuzao</SpellLink>
            {t({ id: 'monk.brewmaster.niuzao.explanation.p1', message: " is Brewmaster's major damage cooldown. Most of the direct damage from Niuzao comes from triggering " })}
            <SpellLink spell={SPELLS_COMMON.NIUZAO_STOMP_DAMAGE} />
            {t({ id: 'monk.brewmaster.niuzao.explanation.p2', message: ' by casting ' })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK} />
            {t({ id: 'monk.brewmaster.niuzao.explanation.p3', message: ". However, at this time " })}
            <strong>{t({ id: 'monk.brewmaster.niuzao.explanation.bold', message: "Niuzao's direct damage is low" })}</strong>
            {t({ id: 'monk.brewmaster.niuzao.explanation.p4', message: '. You should play normally during ' })}
            <SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Invoke Niuzao</SpellLink>
            {t({ id: 'monk.brewmaster.niuzao.explanation.p5', message: ' unless playing ' })}
            <SpellLink spell={SPELLS.WISDOM_OF_THE_WALL_TALENT}>Shado-Pan</SpellLink>
            {t({ id: 'monk.brewmaster.niuzao.explanation.p6', message: '.' })}
          </>
        </p>
        {info.combatant.hasTalent(SPELLS.WISDOM_OF_THE_WALL_TALENT) && (
          <p>
            <>
              <SpellLink spell={SPELLS.WISDOM_OF_THE_WALL_TALENT}>Shado-Pan</SpellLink>
              {t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.p1', message: ' Brewmasters additionally trigger ' })}
              <SpellLink spell={SPELLS.FLURRY_STRIKES_TALENT} />
              {t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.p2', message: ' from ' })}
              <SpellLink spell={SPELLS.BREATH_OF_FIRE_TALENT} />
              {t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.p3', message: ' while Niuzao is active. This ' })}
              <strong>{t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.bold', message: 'greatly buffs' })}</strong>
              {t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.p4', message: ' ' })}
              <SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Invoke Niuzao</SpellLink>
              {t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.p5', message: ' but changes your priority: use ' })}
              <SpellLink spell={SPELLS.BREATH_OF_FIRE_TALENT} />
              {t({ id: 'monk.brewmaster.niuzao.shado_pan_explanation.p6', message: ' as much as possible while Niuzao is active.' })}
            </>
          </p>
        )}
      </Explanation>
      <CooldownGrid
        label={
          <SpellLink spell={SPELLS.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Invoke Niuzao</SpellLink>
        }
        timeline={{
          cooldowns: [
            SPELLS.BLACKOUT_KICK,
            SPELLS.BREATH_OF_FIRE_TALENT,
            SPELLS.KEG_SMASH_TALENT,
            SPELLS.BLACK_OX_BREW_TALENT,
          ],
        }}
        table={{
          type: EventType.Damage,
        }}
        items={invoke.niuzaoCasts.map((cast) => {
          const { perf, checklist } = invoke.checklist(cast);
          return {
            perf,
            checklistItems: checklist,
            range: {
              start: cast.summonEvent.timestamp,
              end: cast.deathEvent?.timestamp ?? info.fightEnd,
            },
          };
        })}
      />
    </SubSection>
  );
}
