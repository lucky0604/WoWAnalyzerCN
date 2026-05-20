import styled from '@emotion/styled';
import SPELLS from 'common/SPELLS';
import talents from 'common/TALENTS/monk';
import { SpellLink, TooltipElement } from 'interface';
import { SubSection, useAnalyzer, useInfo } from 'interface/guide';
import CastReasonBreakdownTableContents from 'interface/guide/components/CastReasonBreakdownTableContents';
import ExplanationRow from 'interface/guide/components/ExplanationRow';
import PassFailBar from 'interface/guide/components/PassFailBar';
import { useMemo, type JSX } from 'react';
import BlackoutCombo from './index';
import { Trans } from '@lingui/react/macro';

enum ComboEffect {
  KegSmash = talents.KEG_SMASH_TALENT.id,
  TigerPalm = SPELLS.TIGER_PALM.id,
}

const comboEffectOrder = [ComboEffect.TigerPalm, ComboEffect.KegSmash];

const comboEffectLabel = (effect: ComboEffect) => <SpellLink spell={effect} />;

const ComboUsageTable = styled.table`
  width: max-content;
  height: max-content;
  margin: 0 2em;

  td {
    padding-left: 1em;
  }

  td:first-child {
    padding-left: 0;
  }
`;

export default function BlackoutComboSection(): JSX.Element | null {
  const analyzer = useAnalyzer(BlackoutCombo);
  const info = useInfo();

  const hasPta = info?.combatant.hasTalent(talents.PRESS_THE_ADVANTAGE_TALENT);

  const reasons = useMemo(() => {
    if (!analyzer?.active) {
      return [];
    }

    return Object.entries(analyzer.spellsBOCWasUsedOn).flatMap(([spellId, count]) =>
      Array.from({ length: count }, () => ({ reason: parseInt(spellId) as ComboEffect })),
    );
  }, [analyzer]);

  const possibleCombos = useMemo(
    () =>
      hasPta
        ? comboEffectOrder.filter((effect) => effect !== ComboEffect.TigerPalm)
        : comboEffectOrder,
    [hasPta],
  );

  if (!analyzer?.active) {
    return null;
  }
  return (
    <SubSection title={talents.BLACKOUT_COMBO_TALENT.name}>
      <ExplanationRow leftPercent={45}>
        <div>
          <p>
            <Trans id="monk.brewmaster.blackout_combo.recommended">
              The recommended way to use <SpellLink spell={talents.BLACKOUT_COMBO_TALENT} />
              's combo bonuses is:
            </Trans>
          </p>
          <ul>
            <li style={{ opacity: hasPta ? 0.5 : 1 }}>
              <div>
                <strong>
                  <Trans id="monk.brewmaster.blackout_combo.tp_always">
                    <SpellLink spell={SPELLS.TIGER_PALM} />: Almost Always.
                  </Trans>
                </strong>
              </div>
              <div>
                <Trans id="monk.brewmaster.blackout_combo.tp_desc">
                  Comboing <SpellLink spell={SPELLS.TIGER_PALM} /> is the best way to use{' '}
                  <SpellLink spell={talents.BLACKOUT_COMBO_TALENT} /> for damage in single-target and
                  light AoE settings. You will frequently see high ranked raiders using this option.
                </Trans>
              </div>
            </li>
            <li>
              <div>
                <strong>
                  <Trans id="monk.brewmaster.blackout_combo.ks_sometimes">
                    <SpellLink spell={talents.KEG_SMASH_TALENT} />: Sometimes.
                  </Trans>
                </strong>
              </div>
              <div>
                <Trans id="monk.brewmaster.blackout_combo.ks_desc">
                  Purely defensive, but not bad. This is more often used in multi-target settings
                  where <SpellLink spell={SPELLS.TIGER_PALM} /> is less valuable.
                </Trans>
              </div>
            </li>
          </ul>
        </div>
        <ComboUsageTable>
          <tbody>
            <tr>
              <td>
                <TooltipElement
                  content={
                    <Trans id="monk.brewmaster.blackout_combo.buff_tooltip">
                      <SpellLink spell={SPELLS.BLACKOUT_COMBO_BUFF} /> is a buff. If you wait long
                      enough before using a combo spell, it will expire and do nothing!
                    </Trans>
                  }
                >
                  <Trans id="monk.brewmaster.blackout_combo.combos_used">Combos Used</Trans>
                </TooltipElement>
              </td>
              <td>
                {analyzer.blackoutComboConsumed} / {analyzer.blackoutComboBuffs}
              </td>
              <td>
                <PassFailBar
                  pass={analyzer.blackoutComboConsumed}
                  total={analyzer.blackoutComboBuffs}
                />
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th colSpan={3}>
                <Trans id="monk.brewmaster.blackout_combo.breakdown_title">Spell Combo Breakdown</Trans>
              </th>
            </tr>
          </tbody>
          <CastReasonBreakdownTableContents
            casts={reasons}
            label={comboEffectLabel}
            possibleReasons={possibleCombos}
          />
          <tbody>
            <tr>
              <td colSpan={3} style={{ paddingTop: '1em' }}>
                <em>
                  <Trans id="monk.brewmaster.blackout_combo.wip">Work in Progress</Trans>
                </em>
              </td>
            </tr>
          </tbody>
        </ComboUsageTable>
      </ExplanationRow>
    </SubSection>
  );
}
