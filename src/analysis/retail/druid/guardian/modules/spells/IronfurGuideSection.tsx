import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import uptimeBarSubStatistic from 'parser/ui/UptimeBarSubStatistic';
import ExplanationRow from 'interface/guide/components/ExplanationRow';
import Explanation from 'interface/guide/components/Explanation';
import DamageTakenPointChart, {
  TrackedHit,
} from 'interface/guide/components/DamageTakenPointChart';
import { GoodColor, Section, useAnalyzer, useInfo } from 'interface/guide';
import Ironfur, { IronfurTrackedHit } from 'analysis/retail/druid/guardian/modules/spells/Ironfur';
import SPELLS from 'common/SPELLS';
import { formatDuration, formatNumber } from 'common/format';
import { SpellLink } from 'interface';
import { maybeGetTalentOrSpell } from 'common/maybeGetTalentOrSpell';

function HitTooltipContent({ hit }: { hit: TrackedHit }) {
  const info = useInfo()!;
  const damage = hit.event.amount + (hit.event.absorbed || 0);
  const spell = maybeGetTalentOrSpell(hit.event.ability.guid);
  
  return (
    <div>
      <div>
        <strong>{t({ id: 'guardian.ironfur.tooltip.time', message: 'Time:' })}</strong>{' '}
        {formatDuration(hit.event.timestamp - info.fightStart)}
      </div>
      <div>
        <strong>{t({ id: 'guardian.ironfur.tooltip.stacks', message: 'Ironfur Stacks:' })}</strong>{' '}
        {(hit as IronfurTrackedHit).stacks}
      </div>
      <div>
        {t({ id: 'guardian.ironfur.tooltip.damage', message: 'You took' })}{' '}
        <strong>{formatNumber(damage)}</strong>{' '}
        {t({ id: 'guardian.ironfur.tooltip.from', message: 'from' })}{' '}
        <SpellLink spell={spell || hit.event.ability.guid}>
          {spell?.name || hit.event.ability.name}
        </SpellLink>.
      </div>
    </div>
  );
}

export default function IronfurSection(): JSX.Element {
  const info = useInfo()!;
  const ironfur = useAnalyzer(Ironfur)!;

  const uptimeBar = uptimeBarSubStatistic(
    { start_time: info.fightStart, end_time: info.fightEnd },
    {
      spells: [SPELLS.IRONFUR],
      uptimes: ironfur.uptime,
      color: GoodColor,
    },
  );

  return (
    <Section title={t({ id: 'guardian.ironfur.title', message: 'Ironfur' })}>
      <ExplanationRow>
        <Explanation>
          <p>
            <strong>
              <SpellLink spell={SPELLS.IRONFUR} />{' '}
              {t({
                id: 'guardian.ironfur.coreAbility',
                message: "is Guardian's core defensive ability.",
              })}
            </strong>
          </p>
          <p>
            {t({
              id: 'guardian.ironfur.armorIncrease',
              message:
                'It greatly increases your armor, which greatly reduces most incoming physical damage (like melee attacks).',
            })}{' '}
            <strong>
              {t({
                id: 'guardian.ironfur.alwaysOneStack',
                message: 'You should aim to always have at least one stack of',
              })}{' '}
              <SpellLink spell={SPELLS.IRONFUR} />{' '}
              {t({ id: 'guardian.ironfur.activeTank', message: 'while you are the active tank.' })}
            </strong>
          </p>
          <p>
            {t({
              id: 'guardian.ironfur.uptimeChart',
              message:
                'This chart shows your Ironfur uptime along with the physical hits you took. Melee hits taken without Ironfur (shown in red) can be very dangerous!',
            })}
          </p>
        </Explanation>
        <div>
          <strong>
            {i18n._({
              id: 'guardian.ironfur.uptimeLabel',
              message: 'Ironfur Uptime - you mitigated {covered} / {total} hits',
              values: {
                covered: ironfur.coveredHits,
                total: ironfur.totalHits,
              },
            })}
          </strong>
          {uptimeBar}
          <strong>{t({ id: 'guardian.ironfur.damageTaken', message: 'Damage Taken' })}</strong>{' '}
          <small>
            -{' '}
            {t({
              id: 'guardian.ironfur.damageTakenLegend',
              message:
                'Hits without Ironfur are shown in red, with 1 stack in green, and with multiple stacks in blue',
            })}
          </small>
          <DamageTakenPointChart hits={ironfur.hits} tooltip={HitTooltipContent} />
        </div>
      </ExplanationRow>
    </Section>
  );
}
