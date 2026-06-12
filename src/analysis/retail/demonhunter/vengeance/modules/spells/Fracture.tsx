import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import TALENTS, { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import SPELLS from 'common/SPELLS/demonhunter';
import { SpellLink } from 'interface';
import Events, { CastEvent, RemoveBuffStackEvent } from 'parser/core/Events';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import {
  UNRESTRAINED_FURY_SCALING,
  UNTETHERED_FURY_SCALING,
} from 'analysis/retail/demonhunter/shared';
import { CELESTIAL_ECHOES } from '../../constants';
import {
  ChecklistUsageInfo,
  SpellUse,
  spellUseToBoxRowEntry,
  UsageInfo,
} from 'parser/core/SpellUsage/core';
import { combineQualitativePerformances } from 'common/combineQualitativePerformances';
import { logSpellUseEvent } from 'parser/core/SpellUsage/SpellUsageSubSection';
import ResourceLink from 'interface/ResourceLink';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import ContextualSpellUsageSubSection from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import {
  getGeneratingCast,
  getResourceChange,
  getWastedSoulFragment,
} from 'analysis/retail/demonhunter/vengeance/normalizers/FractureNormalizer';
import Combatant from 'parser/core/Combatant';
import { addInefficientCastReason } from 'parser/core/EventMetaLib';
import { NumberThreshold, ThresholdStyle } from 'parser/core/ParseResults';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const DEFAULT_IN_META_FURY_LIMIT = 60;
const DEFAULT_NOT_META_FURY_LIMIT = 75;

const IN_META_SOUL_FRAGMENTS_LIMIT = 4;
const NOT_META_SOUL_FRAGMENTS_LIMIT = 5;

function getTalentMaxFuryIncreases(combatant: Combatant) {
  return (
    UNRESTRAINED_FURY_SCALING[combatant.getTalentRank(TALENTS.UNRESTRAINED_FURY_TALENT)] +
    UNTETHERED_FURY_SCALING[combatant.getTalentRank(TALENTS.UNTETHERED_FURY_TALENT)]
  );
}

function getFuryModifier(combatant: Combatant) {
  return (
    getTalentMaxFuryIncreases(combatant) -
    (combatant.hasTalent(TALENTS_DEMON_HUNTER.CELESTIAL_ECHOES_TALENT) ? CELESTIAL_ECHOES : 0)
  );
}

export default class Fracture extends Analyzer {
  #cooldownUses: SpellUse[] = [];
  #inMetaFuryLimit = DEFAULT_IN_META_FURY_LIMIT;
  #notMetaFuryLimit = DEFAULT_NOT_META_FURY_LIMIT;
  #lastCast: CastEvent | undefined;
  #badCasts = 0;

  constructor(options: Options) {
    super(options);

    const furyModifier = getFuryModifier(this.selectedCombatant);

    this.#inMetaFuryLimit = DEFAULT_IN_META_FURY_LIMIT + furyModifier;
    this.#notMetaFuryLimit = DEFAULT_NOT_META_FURY_LIMIT + furyModifier;

    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.FRACTURE), this.onCast);
    this.addEventListener(
      Events.removebuffstack.by(SELECTED_PLAYER).spell(SPELLS.SOUL_FRAGMENT_STACK),
      this.onSoulFragmentBuffFade,
    );
  }

  guideSubsection() {
    const explanation = (
      <p>
        <strong><SpellLink spell={SPELLS.FRACTURE} /></strong>
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p1', message: ' is your primary ' })}
        <strong>{t({ id: 'demonhunter.vengeance.fracture.guideExplanation.bold', message: 'builder' })}</strong>
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p2', message: ' for ' })}
        <ResourceLink id={RESOURCE_TYPES.FURY.id} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p3', message: ' and ' })}
        <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p4', message: 's. Cast it when you have less than 5 ' })}
        <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p5', message: `s and less than ${this.#notMetaFuryLimit} ` })}
        <ResourceLink id={RESOURCE_TYPES.FURY.id} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p6', message: '. In ' })}
        <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p7', message: ', cast it when you have less than 4 ' })}
        <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p8', message: `s and less than ${this.#inMetaFuryLimit} ` })}
        <ResourceLink id={RESOURCE_TYPES.FURY.id} />
        {t({ id: 'demonhunter.vengeance.fracture.guideExplanation.p9', message: '.' })}
      </p>
    );

    const performances = this.#cooldownUses.map((it) =>
      spellUseToBoxRowEntry(it, this.owner.fight.start_time),
    );

    const goodCasts = performances.filter((it) => it.value === QualitativePerformance.Good).length;
    const totalCasts = performances.length;

    return (
      <ContextualSpellUsageSubSection
        explanation={explanation}
        uses={this.#cooldownUses}
        castBreakdownSmallText={
          <>
            {' '}
            -{' '}
            <Trans id="demonhunter.vengeance.fracture.castBreakdown">
              Green is a good cast, Red is a bad cast.
            </Trans>
          </>
        }
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          <CastPerformanceSummary
            spell={SPELLS.FRACTURE}
            casts={goodCasts}
            performance={QualitativePerformance.Good}
            totalCasts={totalCasts}
          />
        }
      />
    );
  }

  get wastedCasts(): NumberThreshold {
    return {
      actual: this.#badCasts,
      isGreaterThan: {
        minor: 0,
        average: 0,
        major: 1,
      },
      style: ThresholdStyle.NUMBER,
    };
  }

  private onCast(event: CastEvent) {
    // Fractures are good IF:
    // in Metamorphosis - < 4 Soul Fragments and < inMetaFury Fury
    // out of Metamorphosis - < 5 Soul Fragments and < notMetaFury Fury
    const hasMetamorphosis = this.selectedCombatant.hasBuff(
      SPELLS.METAMORPHOSIS_TANK.id,
      event.timestamp,
    );

    const hasExtraDetails = hasMetamorphosis;
    const extraDetails = (
      <div>
        {hasMetamorphosis && (
          <p>
            Was in <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />, increasing Fury and Soul
            Fragment generation
          </p>
        )}
      </div>
    );

    const checklistItems: ChecklistUsageInfo[] = [
      { check: 'fury', timestamp: event.timestamp, ...this.getCastFuryPerformance(event) },
      {
        check: 'soul-fragments',
        timestamp: event.timestamp,
        ...this.getCastSoulFragmentPerformance(event),
      },
    ];
    const actualPerformance = combineQualitativePerformances(
      checklistItems.map((item) => item.performance),
    );
    this.#cooldownUses.push({
      event,
      performance: actualPerformance,
      checklistItems,
      performanceExplanation:
        actualPerformance !== QualitativePerformance.Fail
          ? `${actualPerformance} ${t({ id: 'demonhunter.vengeance.shared.usage', message: 'Usage' })}`
          : t({ id: 'demonhunter.vengeance.shared.badUsage', message: 'Bad Usage' }),
      extraDetails: hasExtraDetails ? extraDetails : undefined,
    });
  }

  private getCastFuryPerformance(event: CastEvent): UsageInfo {
    const hasMetamorphosis = this.selectedCombatant.hasBuff(
      SPELLS.METAMORPHOSIS_TANK.id,
      event.timestamp,
    );
    const resourceChange = getResourceChange(event);

    const inMetamorphosisSummary = (
      <div>
        <Trans id="demonhunter.vengeance.fracture.castDuringMeta">
          Cast at &lt; {this.#inMetaFuryLimit} Fury during Metamorphosis
        </Trans>
      </div>
    );
    const nonMetamorphosisSummary = (
      <div>
        <Trans id="demonhunter.vengeance.fracture.castOutsideMeta">
          Cast at &lt; {this.#notMetaFuryLimit} Fury
        </Trans>
      </div>
    );

    if (!resourceChange) {
      return {
        performance: QualitativePerformance.Ok,
        summary: hasMetamorphosis ? inMetamorphosisSummary : nonMetamorphosisSummary,
        details: (
          <div>
            {t({ id: 'demonhunter.vengeance.fracture.unableToDetermine.p1', message: 'Unable to determine from logs how much ' })}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} />
            {t({ id: 'demonhunter.vengeance.fracture.unableToDetermine.p2', message: ' you had when you cast ' })}
            <SpellLink spell={SPELLS.FRACTURE} />
            {t({ id: 'demonhunter.vengeance.fracture.unableToDetermine.p3', message: '.' })}
          </div>
        ),
      };
    }

    // We need to back-calculate the fury performance due to Fracture event ordering causing the
    // FuryTracker to not have the correct value when invoking `furyTracker.current`.
    const amountNotWasted = resourceChange.resourceChange - resourceChange.waste;
    const amountOfFuryAfterChange =
      resourceChange.classResources?.find((it) => it.type === RESOURCE_TYPES.FURY.id)?.amount ?? 0;
    const amountOfFury = amountOfFuryAfterChange - amountNotWasted;

    if (hasMetamorphosis) {
      if (amountOfFury < this.#inMetaFuryLimit) {
        return {
          performance: QualitativePerformance.Good,
          summary: inMetamorphosisSummary,
          details: (
            <div>
              You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfFury}{' '}
              <ResourceLink id={RESOURCE_TYPES.FURY.id} /> when the recommended amount is less than{' '}
              {this.#inMetaFuryLimit} during <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />. Good
              job!
            </div>
          ),
        };
      }
      return {
        performance: QualitativePerformance.Fail,
        summary: inMetamorphosisSummary,
        details: (
          <div>
            You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfFury}{' '}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} /> when the recommended amount is less than{' '}
            {this.#inMetaFuryLimit} during <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />. Work on
            spending your <ResourceLink id={RESOURCE_TYPES.FURY.id} /> before pressing{' '}
            <SpellLink spell={SPELLS.FRACTURE} />.
          </div>
        ),
      };
    }
    if (amountOfFury < this.#notMetaFuryLimit) {
      return {
        performance: QualitativePerformance.Good,
        summary: nonMetamorphosisSummary,
        details: (
          <div>
            You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfFury}{' '}
            <ResourceLink id={RESOURCE_TYPES.FURY.id} /> when the recommended amount is less than{' '}
            {this.#notMetaFuryLimit}. Good job!
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Fail,
      summary: nonMetamorphosisSummary,
      details: (
        <div>
          You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfFury}{' '}
          <ResourceLink id={RESOURCE_TYPES.FURY.id} /> when the recommended amount is less than{' '}
          {this.#notMetaFuryLimit}. Work on spending your{' '}
          <ResourceLink id={RESOURCE_TYPES.FURY.id} /> before pressing{' '}
          <SpellLink spell={SPELLS.FRACTURE} />.
        </div>
      ),
    };
  }

  private getCastSoulFragmentPerformance(event: CastEvent): UsageInfo {
    const hasMetamorphosis = this.selectedCombatant.hasBuff(
      SPELLS.METAMORPHOSIS_TANK.id,
      event.timestamp,
    );
    const amountOfSoulFragments = this.selectedCombatant.getBuffStacks(
      SPELLS.SOUL_FRAGMENT_STACK.id,
      event.timestamp,
    );

    const inMetamorphosisSummary = (
      <div>
        <Trans id="demonhunter.vengeance.fracture.soulFragmentCastDuringMeta">
          Cast at &lt; {IN_META_SOUL_FRAGMENTS_LIMIT} Soul Fragments during Metamorphosis
        </Trans>
      </div>
    );
    const nonMetamorphosisSummary = (
      <div>
        <Trans id="demonhunter.vengeance.fracture.soulFragmentCastOutsideMeta">
          Cast at &lt; {NOT_META_SOUL_FRAGMENTS_LIMIT} Soul Fragments
        </Trans>
      </div>
    );

    if (hasMetamorphosis) {
      if (amountOfSoulFragments < IN_META_SOUL_FRAGMENTS_LIMIT) {
        return {
          performance: QualitativePerformance.Good,
          summary: inMetamorphosisSummary,
          details: (
            <div>
              You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfSoulFragments}{' '}
              <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />s when the recommended amount is less
              than {IN_META_SOUL_FRAGMENTS_LIMIT} during{' '}
              <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />. Good job!
            </div>
          ),
        };
      }
      return {
        performance: QualitativePerformance.Fail,
        summary: inMetamorphosisSummary,
        details: (
          <div>
            You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfSoulFragments}{' '}
            <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />s when the recommended amount is less
            than {IN_META_SOUL_FRAGMENTS_LIMIT} during{' '}
            <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />. Work on spending your{' '}
            <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />s before pressing{' '}
            <SpellLink spell={SPELLS.FRACTURE} />.
          </div>
        ),
      };
    }
    if (amountOfSoulFragments < NOT_META_SOUL_FRAGMENTS_LIMIT) {
      return {
        performance: QualitativePerformance.Good,
        summary: nonMetamorphosisSummary,
        details: (
          <div>
            You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfSoulFragments}{' '}
            <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />s when the recommended amount is less
            than {NOT_META_SOUL_FRAGMENTS_LIMIT}. Good job!
          </div>
        ),
      };
    }
    return {
      performance: QualitativePerformance.Fail,
      summary: nonMetamorphosisSummary,
      details: (
        <div>
          You cast <SpellLink spell={SPELLS.FRACTURE} /> at {amountOfSoulFragments}{' '}
          <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />s when the recommended amount is less than{' '}
          {NOT_META_SOUL_FRAGMENTS_LIMIT} during <SpellLink spell={SPELLS.METAMORPHOSIS_TANK} />.
          Work on spending your <SpellLink spell={SPELLS.SOUL_FRAGMENT_STACK} />s before pressing{' '}
          <SpellLink spell={SPELLS.FRACTURE} />.
        </div>
      ),
    };
  }

  private onSoulFragmentBuffFade(event: RemoveBuffStackEvent) {
    const wastedSoulFragment = getWastedSoulFragment(event);
    if (!wastedSoulFragment) {
      return;
    }
    const generatingCast = getGeneratingCast(wastedSoulFragment);
    if (!generatingCast) {
      return;
    }

    // Exit early if the wasted soul is from the same fracture cast
    if (this.#lastCast?.timestamp === generatingCast.timestamp) {
      return;
    }

    this.#lastCast = generatingCast;
    this.#badCasts += 1;
    addInefficientCastReason(this.#lastCast, 'Fracture cast that overcapped souls');
  }
}
