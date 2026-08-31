import { GuideProps, PassFailCheckmark, Section, SubSection } from 'interface/guide';
import { ResourceLink, SpellLink } from 'interface';
import { TALENTS_EVOKER } from 'common/TALENTS';
import CombatLogParser from '../../CombatLogParser';
import SPELLS from 'common/SPELLS';

import PassFailBar from 'interface/guide/components/PassFailBar';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { TIERS } from 'game/TIERS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { IMMINENT_DESTRUCTION_INITIAL_STACKS_DEVA } from 'analysis/retail/evoker/shared';
import { STRAFING_RUN_DURATION } from 'analysis/retail/evoker/devastation/constants';
import { formatDurationMillisMinSec } from 'common/format';
import { InformationIcon } from 'interface/icons';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

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

export function DamageEfficiency(props: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.title',
        message: 'Damage Efficiency',
      })}
    >
      <DisintegrateSubsection {...props} />
      <NoWastedProcsSubsection {...props} />
      <NoWastedBuffsSubsection {...props} />
    </Section>
  );
}

function DisintegrateSubsection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const tickData = modules.disintegrate.tickData;
  if (tickData.regularTicks === 0) {
    return null;
  }

  const isEarlyChainingOptimal = false;

  return (
    <SubSection
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.title',
        message: 'Clipping/Chaining Disintegrate',
      })}
    >
      <p>
        <>{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary.p1',message:'You should always aim to chain '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary.p2',message:'. Chaining refers to recasting '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary.p3',message:' while already channeling a '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary.p4',message:' after the penultimate (second to last) tick in order to channel two '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary.p5',message:' in a row without downtime or losing a tick. This is essentially just the same Pandemic effect that DoTs have since '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary.p6',message:' functions as a DoT.'})}</>
      </p>
      {isEarlyChainingOptimal && (
        <p>
          <>{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p1',message:'Inside of '})}<SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p2',message:' you should be clipping '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p3',message:' after the third tick with more important spells such '})}<SpellLink spell={SPELLS.FIRE_BREATH} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p4',message:', '})}<SpellLink spell={SPELLS.ETERNITY_SURGE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p5',message:', '})}<SpellLink spell={SPELLS.SHATTERING_STAR} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p6',message:' or '})}<SpellLink spell={SPELLS.BURNOUT_BUFF} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p7',message:'. As well as early chaining your '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining.p8',message:' after the third tick to maximize resources generation and expenditure.'})}</>
        </p>
      )}
      <p>
        <>{t({ id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.wowhead.p1', message: 'See the' })}
          {' '}
          <a href="https://www.wowhead.com/guide/classes/evoker/devastation/rotation-cooldowns-pve-dps#advanced-disintegrate-chaining-and-clipping">{t({ id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.wowhead.a', message: 'Disintegrate Chaining and Clipping' })}</a>
          {' '}
          {t({ id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.wowhead.p2', message: 'section on wowhead for a more in-depth explanation.' })}
        </>
      </p>
      <ExplanationAndDataSubSection
        explanationPercent={EXPLANATION_PERCENTAGE}
        explanation={
          <div>
            <p>
              <><SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.outsideDR.p1',message:' efficiency outside of '})}<SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} /></>
            </p>
            <p>
              {t({
                id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.noDropTicks',
                message: 'You should not be dropping any ticks here.',
              })}
            </p>
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
      <ExplanationAndDataSubSection
        explanationPercent={EXPLANATION_PERCENTAGE}
        explanation={
          <div>
            <p>
              <><SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.duringDR.p1',message:' efficiency during '})}<SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} /></>
            </p>
            <p>
              {t({
                id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.clipBeneficial',
                message:
                  'It can sometimes be beneficial to clip Disintegrate early in order to cast more important spells.',
              })}
            </p>
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

      {info.combatant.hasTalent(TALENTS_EVOKER.MASS_DISINTEGRATE_TALENT) && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <div>
              <p>
                <><SpellLink spell={SPELLS.MASS_DISINTEGRATE_BUFF} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.disintegrate.massDisintegrate.p1',message:' efficiency'})}</>
              </p>
              <p>
                {t({
                  id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.noDropTicks',
                  message: 'You should not be dropping any ticks here.',
                })}
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
  );
}

function NoWastedProcsSubsection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const hasMID1TierSet = info.combatant.has2PieceByTier(TIERS.MID1);

  return (
    <SubSection
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.title',
        message: 'No Wasted Procs',
      })}
    >
      <p>
        <InformationIcon />{' '}
        {t({
          id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.note',
          message:
            "Note that procs that weren't used by the time the fight ended are counted as wasted.",
        })}
      </p>
      <ExplanationAndDataSubSection
        explanationPercent={EXPLANATION_PERCENTAGE}
        explanation={
          <p>
            <><SpellLink spell={SPELLS.ESSENCE_BURST_BUFF} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.essenceBurst.p1',message:' procs are essential because they help you cast your primary damaging spells, '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.essenceBurst.p2',message:' and '})}<SpellLink spell={TALENTS_EVOKER.PYRE_TALENT} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.essenceBurst.p3',message:', for free.'})}
              <div>
                <strong>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.essenceBurst.bold',message:'None should go to waste.'})}</strong>
              </div></>
          </p>
        }
        data={
          <PassFail
            value={modules.essenceBurst.consumedProcs}
            total={Math.max(modules.essenceBurst.procs, modules.essenceBurst.consumedProcs)}
            passed={
              modules.essenceBurst.consumedProcs ===
              Math.max(modules.essenceBurst.procs, modules.essenceBurst.consumedProcs)
            }
          />
        }
      />
      {!hasMID1TierSet && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <><SpellLink spell={TALENTS_EVOKER.BURNOUT_TALENT} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.burnout.p1',message:' procs allow you to cast '})}<SpellLink spell={SPELLS.LIVING_FLAME_CAST} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.burnout.p2',message:' instantly.'})}
                <div>
                  <strong>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.burnout.bold.p1',message:'Ideally none should go to waste, but some may drop during an intense '})}<SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.burnout.bold.p2',message:' window.'})}</strong>
                </div></>
            </p>
          }
          data={
            <PassFail
              value={modules.burnout.consumedProcs}
              total={Math.max(modules.burnout.procs, modules.burnout.consumedProcs)}
              passed={
                modules.burnout.consumedProcs ===
                Math.max(modules.burnout.procs, modules.burnout.consumedProcs)
              }
            />
          }
        />
      )}
    </SubSection>
  );
}

function NoWastedBuffsSubsection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const hasImminentDestruction = info.combatant.hasTalent(
    TALENTS_EVOKER.IMMINENT_DESTRUCTION_DEVASTATION_TALENT,
  );
  const hasStrafingRun = info.combatant.hasTalent(TALENTS_EVOKER.STRAFING_RUN_TALENT);
  const hasMassDisintegrate = info.combatant.hasTalent(TALENTS_EVOKER.MASS_DISINTEGRATE_TALENT);
  const hasAzureSweep = info.combatant.hasTalent(TALENTS_EVOKER.AZURE_SWEEP_TALENT);
  const hasUnboundFlame = info.combatant.hasTalent(TALENTS_EVOKER.RISING_FURY_3_DEVASTATION_TALENT);

  if (!hasImminentDestruction && !hasStrafingRun && !hasMassDisintegrate && !hasAzureSweep) {
    return null;
  }

  console.log(modules.azureSweep.buffRatio);

  return (
    <SubSection
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.title',
        message: 'No Wasted Buffs',
      })}
    >
      <p>
        <InformationIcon />{' '}
        {t({
          id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.note',
          message:
            "Note that buffs that weren't used by the time the fight ended are counted as wasted.",
        })}
      </p>
      {hasUnboundFlame && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <strong>
                <SpellLink spell={SPELLS.UNBOUND_FLAME} />
              </strong>{' '}
              is a powerful spell, gained after Dragonrage expires. It is your highest priority
              filler spell, because it has a guaranteed chance to produce an{' '}
              <SpellLink spell={SPELLS.ESSENCE_BURST_BUFF} />.
              <div>
                <strong>None should go to waste.</strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.risingFury.usedUnboundFlameStacks}
              total={modules.risingFury.totalUnboundFlameStacks}
              passed={
                modules.risingFury.usedUnboundFlameStacks ===
                modules.risingFury.totalUnboundFlameStacks
              }
            />
          }
        />
      )}
      {hasMassDisintegrate && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <strong>
                <SpellLink spell={SPELLS.MASS_DISINTEGRATE_BUFF} />
              </strong>{' '}
              {t({
                id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.massDisintegrate',
                message:
                  'is a powerful buff gained by casting Empowers which increases the damage of Disintegrate and allows it to strike multiple targets.',
              })}
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.noneToWaste',
                    message: 'None should go to waste.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.massDisintegrate.consumedBuffs}
              total={modules.massDisintegrate.totalBuffs}
              passed={modules.massDisintegrate.wastedBuffs === 0}
            />
          }
        />
      )}
      {hasImminentDestruction && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <><strong>
                  <SpellLink
                    spell={TALENTS_EVOKER.IMMINENT_DESTRUCTION_DEVASTATION_TALENT}
                  />
                </strong>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.imminentDestruction.p1',message:' reduces the '})}<ResourceLink id={RESOURCE_TYPES.ESSENCE.id} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.imminentDestruction.p2',message:' cost of your next '})}<strong>{IMMINENT_DESTRUCTION_INITIAL_STACKS_DEVA}</strong>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.imminentDestruction.p3',message:' '})}<SpellLink spell={SPELLS.DISINTEGRATE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.imminentDestruction.p4',message:' and '})}<SpellLink spell={SPELLS.PYRE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.imminentDestruction.p5',message:'.'})}</>
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.noneToWaste',
                    message: 'None should go to waste.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.imminentDestruction.consumedBuffs}
              total={modules.imminentDestruction.totalBuffs}
              passed={modules.imminentDestruction.wastedBuffs === 0}
            />
          }
        />
      )}
      {hasStrafingRun && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <><strong>
                  <SpellLink spell={TALENTS_EVOKER.STRAFING_RUN_TALENT} />
                </strong>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.p1',message:' allows '})}<SpellLink spell={SPELLS.DEEP_BREATH} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.p2',message:' to be cast again within '})}{formatDurationMillisMinSec(STRAFING_RUN_DURATION, 0)}{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.p3',message:' of being used.'})}</>
              {hasMassDisintegrate && (
                <div>
                  <>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.scalecommander.p1',message:'When playing as Scalecommander, you should wait with re-casting '})}<SpellLink spell={SPELLS.DEEP_BREATH} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.scalecommander.p2',message:' until '})}<SpellLink spell={TALENTS_EVOKER.MELT_ARMOR_TALENT} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.scalecommander.p3',message:' runs out.'})}</>
                </div>
              )}
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.noneToWaste',
                    message: 'None should go to waste.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.strafingRun.consumedBuffs}
              total={modules.strafingRun.totalBuffs}
              passed={modules.strafingRun.wastedBuffs === 0}
            />
          }
        />
      )}
      {hasAzureSweep && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <><strong>
                  <SpellLink spell={TALENTS_EVOKER.AZURE_SWEEP_TALENT} />
                </strong>{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.azureSweep.p1',message:' is an upgraded version of '})}<SpellLink spell={SPELLS.AZURE_STRIKE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.azureSweep.p2',message:' that is gained after casting '})}<SpellLink spell={SPELLS.ETERNITY_SURGE} />{t({id:'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.azureSweep.p3',message:'.'})}</>
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.azureSweep.note',
                    message:
                      'Ideally none should go to waste, but some may be wasted due to having to cast higher priority spells.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.azureSweep.consumedBuffs}
              total={modules.azureSweep.totalBuffs}
              passed={modules.azureSweep.buffRatio > 0.9}
            />
          }
        />
      )}
    </SubSection>
  );
}
