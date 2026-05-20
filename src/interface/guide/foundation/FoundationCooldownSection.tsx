import { useMemo, type JSX } from 'react';
import { t } from '@lingui/core/macro';
import { SubSection, useInfo } from '../index';
import SPELL_CATEGORY from 'parser/core/SPELL_CATEGORY';
import { maybeGetTalentOrSpell } from 'common/maybeGetTalentOrSpell';
import Explanation from '../components/Explanation';
import CooldownGraphSubsection, { Cooldown } from '../components/CooldownGraphSubSection';
import AlertInfo from 'interface/AlertInfo';
import { FoundationHighlight as HL } from './shared';
import Para from '../Para';
import { useExpansionContext } from 'interface/report/ExpansionContext';

interface Props {
  cooldowns?: Cooldown[];
}

export function FoundationCooldownSection({
  cooldowns: manualCooldowns,
}: Props): JSX.Element | null {
  const abilities = useInfo()?.abilities;
  const { expansion } = useExpansionContext();
  const cooldowns = useMemo(
    () =>
      manualCooldowns ??
      abilities
        ?.filter(
          (ability) =>
            ability.enabled &&
            ability.category === SPELL_CATEGORY.COOLDOWNS &&
            maybeGetTalentOrSpell(ability.primarySpell, expansion),
        )
        .sort((a, b) => b.cooldown - a.cooldown)
        .map((ability) => ({
          spell: maybeGetTalentOrSpell(ability.primarySpell, expansion)!,
          isActive: () => true,
        })),
    [manualCooldowns, abilities, expansion],
  );

  if (!cooldowns || cooldowns.length === 0) {
    return null;
  }

  return (
    <SubSection title={t({ id: 'guide.foundation.cooldowns', message: 'Use Your Cooldowns' })}>
      <Explanation>
        <Para>
          完美的冷却使用是深入的了解战斗机制和玩家技术的结合。然而，90%的情况下，你只需做到以下几点就能获得90%的效果：{' '}
          <strong>
            {t({
              id: 'guide.foundation.cooldowns.keyPoint',
              message: '确保使用所有可用的冷却技能。',
            })}
          </strong>
        </Para>
        <Para>
          关键在于{' '}
          <HL>
            {t({
              id: 'guide.foundation.cooldowns.maximizeUsage',
              message: '尽可能多地使用你的冷却技能。',
            })}
          </HL>
          。例如，你可以在6分钟的战斗中最多使用3次2分钟冷却的技能。只要你用完了全部3次，稍微延迟使用以等待更好的时机也是可以的。
        </Para>
      </Explanation>
      <Para>
        <CooldownGraphSubsection cooldowns={cooldowns} />
      </Para>
      <AlertInfo>
        要最大化利用你的冷却技能，需要掌握专精和首领战的最新知识。我们强烈建议你加入职业社区，例如职业
        Discord 社区服务器，以获取更多关于改善冷却技能使用的信息！
      </AlertInfo>
    </SubSection>
  );
}
