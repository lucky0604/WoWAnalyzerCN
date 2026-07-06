import { GuideProps, PassFailCheckmark, Section, SubSection } from 'interface/guide';
import { SpellLink, TooltipElement } from 'interface';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { TALENTS_EVOKER } from 'common/TALENTS';
import CombatLogParser from '../../CombatLogParser';
import SPELLS from 'common/SPELLS';

import PassFailBar from 'interface/guide/components/PassFailBar';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { JSX } from 'react';
import Spell from 'common/SPELLS/Spell';
import { WarningIcon } from 'interface/icons';

const EXPLANATION_PERCENTAGE = 70;

function PassFail({
  value,
  total,
  passed,
  customTotal,
}: {
  value: number;
  total: number;
  passed: boolean;
  customTotal?: number;
}) {
  return (
    <div>
      <PassFailBar pass={value} total={customTotal ?? total} />
      &nbsp; <PassFailCheckmark pass={passed} />
      <p>
        {value} / {total} ({((value / total) * 100).toFixed(2)}%)
      </p>
    </div>
  );
}

export function DisintegrateSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const tickData = modules.disintegrate.tickData;

  if (tickData.regularTicks + tickData.dragonRageTicks + tickData.massDisintegrateTicks === 0) {
    return null;
  }
  const goodClipSpells: Spell[] = [];
  modules.disintegrate.goodClipSpells.forEach((spell) => {
    if (!goodClipSpells.find((x) => x.name === spell.name)) {
      goodClipSpells.push(spell);
    }
  });

  const clipLogic = modules.disintegrate.activeChainClipLogic;

  // Good Clipping Spells
  const elements: JSX.Element[] = [];
  goodClipSpells.forEach((id) => {
    elements.push(
      <li>
        <SpellLink spell={id}></SpellLink>
      </li>,
    );
  });
  const clippedSpellsContent = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{elements}</ul>
  );

  return (
    <Section
      title={t({ id: 'evoker.devastation.disintegrateSection.title', message: 'Disintegrate' })}
    >
      <div>
        <SubSection
          title={t({
            id: 'evoker.devastation.disintegrateSection.explanation',
            message: 'Explanation',
          })}
        >
          <strong>
            <SpellLink spell={SPELLS.DISINTEGRATE} />
          </strong>{' '}
          <Trans id="evoker.devastation.disintegrateSection.main_desc">
            is the main spender of Devastation Evoker. It is the most nuanced spell in the entire
            kit and as such also has a lot of avenues for optimization. The analysis below uses
            specific, agreed upon, terms which are explained here:
          </Trans>
          <ul>
            <li>
              <>
                <strong>
                  {t({
                    id: 'evoker.devastation.disintegrateSection.chaining_desc.strong',
                    message: 'Chaining',
                  })}
                </strong>
                {t({
                  id: 'evoker.devastation.disintegrateSection.chaining_desc.p1',
                  message: ' - Chaining refers to recasting ',
                })}
                <SpellLink spell={SPELLS.DISINTEGRATE} />
                {t({
                  id: 'evoker.devastation.disintegrateSection.chaining_desc.p2',
                  message: ' while already channeling a ',
                })}
                <SpellLink spell={SPELLS.DISINTEGRATE} />
                {t({
                  id: 'evoker.devastation.disintegrateSection.chaining_desc.p3',
                  message: ' after the penultimate (second to last) tick in order to channel two ',
                })}
                <SpellLink spell={SPELLS.DISINTEGRATE} />
                {t({
                  id: 'evoker.devastation.disintegrateSection.chaining_desc.p4',
                  message: ' in a row without downtime or losing a tick.',
                })}
              </>
            </li>
            <li>
              <>
                <strong>
                  {t({
                    id: 'evoker.devastation.disintegrateSection.early_chaining_desc.strong',
                    message: 'Early Chaining',
                  })}
                </strong>
                {t({
                  id: 'evoker.devastation.disintegrateSection.early_chaining_desc.p1',
                  message: ' - Early chaining refers to chaining two ',
                })}
                <SpellLink spell={SPELLS.DISINTEGRATE} />
                {t({
                  id: 'evoker.devastation.disintegrateSection.early_chaining_desc.p2',
                  message:
                    ' casts before the penultimate tick. This wastes ticks but is occasionally useful.',
                })}
              </>
            </li>
            <li>
              <>
                <strong>
                  {t({
                    id: 'evoker.devastation.disintegrateSection.clipping_desc.strong',
                    message: 'Clipping',
                  })}
                </strong>
                {t({
                  id: 'evoker.devastation.disintegrateSection.clipping_desc.p1',
                  message: ' - Clipping refers to interrupting a channel of ',
                })}
                <SpellLink spell={SPELLS.DISINTEGRATE} />
                {t({
                  id: 'evoker.devastation.disintegrateSection.clipping_desc.p2',
                  message: ' early by using another spell.',
                })}
              </>
            </li>
            <li>
              <>
                {t({
                  id: 'evoker.devastation.disintegrateSection.further_info.p1',
                  message: 'For further information, including which spells you should clip ',
                })}
                <SpellLink spell={SPELLS.DISINTEGRATE} />
                {t({
                  id: 'evoker.devastation.disintegrateSection.further_info.p2',
                  message: ' for, see ',
                })}
                <a href="https://www.wowhead.com/guide/classes/evoker/devastation/rotation-cooldowns-pve-dps#advanced-disintegrate-chaining-and-clipping">
                  {t({
                    id: 'evoker.devastation.disintegrateSection.further_info.link',
                    message: 'Disintegrate Chaining and Clipping',
                  })}
                </a>
              </>
            </li>
          </ul>
          <div>
            <strong>
              <WarningIcon />{' '}
              <Trans id="evoker.devastation.disintegrateSection.clipping_warning">
                Clipping is usually a very minor DPS gain, if any at all. The modules below will
                elaborate whether clipping is relevant. Additionally it is preferred to chain
                correctly if clipping incorrectly is likely
              </Trans>
            </strong>
          </div>
        </SubSection>
      </div>
      <SubSection
        title={t({
          id: 'evoker.devastation.disintegrateSection.overall_tick_efficiency',
          message: 'Overall Tick Efficiency',
        })}
      >
        {tickData.regularTicks > 0 && (
          <ExplanationAndDataSubSection
            explanationPercent={EXPLANATION_PERCENTAGE}
            explanation={
              <div>
                <b>
                  <>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.efficiency_outside.p1',
                      message: 'Efficiency outside of ',
                    })}
                    <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />
                  </>
                </b>
                {clipLogic.thresholdEarlyChainTicks > 1 || clipLogic.allowGoodClipping ? (
                  <p>
                    {clipLogic.thresholdEarlyChainTicks > 1 && (
                      <>
                        {t({
                          id: 'evoker.devastation.disintegrateSection.should_early_chain',
                          message: 'you should be early chaining',
                        })}{' '}
                        <SpellLink spell={SPELLS.DISINTEGRATE} />
                      </>
                    )}
                    {clipLogic.thresholdEarlyChainTicks > 1 && clipLogic.allowGoodClipping ? (
                      <>
                        {t({
                          id: 'evoker.devastation.disintegrateSection.and_you',
                          message: ' and you',
                        })}
                      </>
                    ) : clipLogic.allowGoodClipping ? (
                      <>{t({ id: 'evoker.devastation.disintegrateSection.you', message: 'You' })}</>
                    ) : (
                      <>.</>
                    )}
                    {clipLogic.allowGoodClipping && (
                      <>
                        {' '}
                        {t({
                          id: 'evoker.devastation.disintegrateSection.should_clip_for',
                          message: 'should be clipping',
                        })}{' '}
                        <SpellLink spell={SPELLS.DISINTEGRATE} />{' '}
                        {t({
                          id: 'evoker.devastation.disintegrateSection.in_favor_of',
                          message: 'in favor of',
                        })}{' '}
                        <TooltipElement content={clippedSpellsContent}>
                          {t({
                            id: 'evoker.devastation.disintegrateSection.high_value_spells',
                            message: 'high-value spells',
                          })}
                        </TooltipElement>
                        .
                      </>
                    )}
                  </p>
                ) : (
                  <p>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.no_drop_ticks',
                      message: 'You should not be dropping any ticks here.',
                    })}
                  </p>
                )}
              </div>
            }
            data={
              <PassFail
                value={tickData.regularTicks}
                total={tickData.totalPossibleRegularTicks}
                passed={tickData.regularTickRatio > 0.95}
              />
            }
          />
        )}
        {tickData.dragonRageTicks > 0 && (
          <ExplanationAndDataSubSection
            explanationPercent={EXPLANATION_PERCENTAGE}
            explanation={
              <div>
                <b>
                  <>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.efficiency_during.p1',
                      message: 'Efficiency during ',
                    })}
                    <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />
                  </>
                </b>
                {clipLogic.thresholdEarlyChainTicksDragonrage > 1 ||
                clipLogic.allowGoodClippingDragonrage ? (
                  <p>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.during_dragonrage',
                      message: 'During Dragonrage,',
                    })}{' '}
                    {clipLogic.thresholdEarlyChainTicksDragonrage > 1 && (
                      <>
                        {t({
                          id: 'evoker.devastation.disintegrateSection.should_early_chain',
                          message: 'you should be early chaining',
                        })}{' '}
                        <SpellLink spell={SPELLS.DISINTEGRATE} />
                      </>
                    )}
                    {clipLogic.thresholdEarlyChainTicksDragonrage > 1 &&
                    clipLogic.allowGoodClippingDragonrage ? (
                      <>
                        {t({
                          id: 'evoker.devastation.disintegrateSection.and_you',
                          message: ' and you',
                        })}
                      </>
                    ) : clipLogic.allowGoodClippingDragonrage ? (
                      <>
                        {t({
                          id: 'evoker.devastation.disintegrateSection.you_lower',
                          message: 'you',
                        })}
                      </>
                    ) : (
                      <>.</>
                    )}
                    {clipLogic.allowGoodClippingDragonrage && (
                      <>
                        {' '}
                        {t({
                          id: 'evoker.devastation.disintegrateSection.should_clip_for',
                          message: 'should be clipping',
                        })}{' '}
                        <SpellLink spell={SPELLS.DISINTEGRATE} />{' '}
                        {t({
                          id: 'evoker.devastation.disintegrateSection.in_favor_of',
                          message: 'in favor of',
                        })}{' '}
                        <TooltipElement content={clippedSpellsContent}>
                          {t({
                            id: 'evoker.devastation.disintegrateSection.high_value_spells',
                            message: 'high-value spells',
                          })}
                        </TooltipElement>
                        .
                      </>
                    )}
                  </p>
                ) : (
                  <p>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.no_drop_dragonrage',
                      message: 'During Dragonrage, you should not be dropping any ticks.',
                    })}
                  </p>
                )}
              </div>
            }
            data={
              <PassFail
                value={tickData.dragonRageTicks}
                total={tickData.totalPossibleDragonRageTicks}
                /*customTotal={tickData.totalPossibleDragonRageTicks * 0.75}*/
                passed={tickData.dragonRageTickRatio > 0.9}
              />
            }
          />
        )}

        {info.combatant.hasTalent(TALENTS_EVOKER.MASS_DISINTEGRATE_TALENT) && (
          <ExplanationAndDataSubSection
            explanationPercent={EXPLANATION_PERCENTAGE}
            explanation={
              <div>
                <b>
                  <>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.efficiency_of.p1',
                      message: 'Efficiency of ',
                    })}
                    <SpellLink spell={SPELLS.MASS_DISINTEGRATE_BUFF} />
                  </>
                </b>
                <p>
                  <>
                    {t({
                      id: 'evoker.devastation.disintegrateSection.never_drop_mass_dis.p1',
                      message: 'You should never drop ticks of ',
                    })}
                    <SpellLink spell={SPELLS.MASS_DISINTEGRATE_BUFF} />
                  </>
                </p>
              </div>
            }
            data={
              <PassFail
                value={tickData.massDisintegrateTicks}
                total={tickData.totalPossibleMassDisintegrateTicks}
                passed={
                  tickData.massDisintegrateTicks === tickData.totalPossibleMassDisintegrateTicks
                }
              />
            }
          />
        )}
        {modules.disintegrate.guideSubSection()}
      </SubSection>
    </Section>
  );
}
