import { useMemo, type JSX } from 'react';
import { t, defineMessage } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import SPELLS from 'common/SPELLS';
import { formatDurationMinSec } from 'common/format';
import { SpellLink, TooltipElement } from 'interface';
import CombatLogParser from './CombatLogParser';
import { GuideProps, Section, SubSection, useAnalyzer } from 'interface/guide';
import talents from 'common/TALENTS/monk';
import spells from './spell-list_Monk_Brewmaster.retail';

import MajorDefensivesSection from './modules/core/MajorDefensives';
import CastEfficiencyBar from 'parser/ui/CastEfficiencyBar';
import { GapHighlight } from 'parser/ui/CooldownBar';
import Explanation from 'interface/guide/components/Explanation';
import { Highlight } from 'interface/Highlight';
import { FoundationDowntimeSection } from 'interface/guide/foundation/FoundationDowntimeSection';
import SpellUsageSubSection from 'parser/core/SpellUsage/SpellUsageSubSection';
import AspectOfHarmony from './modules/talents/AspectOfHarmony';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import InvokeNiuzaoSection from './modules/talents/InvokeNiuzao/InvokeNiuzaoSection';
import StaggerPoolSection from './modules/core/StaggerPool/StaggerPoolSection';
import AplChoiceDescription from './modules/core/AplCheck/AplChoiceDescription';
import {
  amountBar,
  literalNumberColumn,
  OTHER_SPECIAL_ID,
  spellName,
} from 'interface/Table/ThroughputTable';
import Table, { Column } from 'interface/Table/Table';
import BlackoutCombo from './modules/spells/BlackoutCombo';
import DamageTracker from 'parser/shared/modules/AbilityTracker';
import PassFailBar from 'interface/guide/components/PassFailBar';
import CastEfficiency from 'parser/shared/modules/CastEfficiency';
import HighTolerance from './modules/spells/HighTolerance';
import Spell from 'common/SPELLS/Spell';
import styles from './Guide.module.scss';

export default function Guide({ info }: GuideProps<typeof CombatLogParser>) {
  return (
    <>
      <Section title={t({ id: 'monk.brewmaster.section.coreSkills', message: 'Core Skills' })}>
        <FoundationDowntimeSection />
      </Section>
      <Section
        title={t({
          id: 'monk.brewmaster.section.staggerManagement',
          message: 'Stagger Management',
        })}
      >
        <p>
          <Trans id="monk.brewmaster.staggerManagement.description">
            Brewmaster's core defensive loop uses <SpellLink spell={SPELLS.STAGGER} /> plus{' '}
            <SpellLink spell={SPELLS.SHUFFLE} /> to convert 60-70% of burst damage into a much less
            dangerous damage-over-time effect (the <em>Stagger pool</em>). We have a variety of ways
            to reduce the damage of this DoT&mdash;the most important of which is{' '}
            <SpellLink spell={talents.PURIFYING_BREW_TALENT} />, which reduces the remaining DoT
            damage by 50% or more.
          </Trans>
        </p>
        <StaggerPoolSection />
        <RotationTipBoxRow>
          <ElevatedPurifyTipBox />
        </RotationTipBoxRow>
      </Section>
      <Section
        title={t({
          id: 'monk.brewmaster.section.rotationAndCooldowns',
          message: 'Rotation & Cooldowns',
        })}
      >
        <SubSection title={t({ id: 'monk.brewmaster.subsection.rotation', message: 'Rotation' })}>
          <AplChoiceDescription />
          <RotationTipBoxRow>
            <CastEfficiencyTipBox
              title={t({
                id: 'monk.brewmaster.tipBox.rotationalSpells',
                message: 'Rotational Abilities',
              })}
              spells={ROTATIONAL_SPELLS}
            />
            <CastEfficiencyTipBox
              title={t({
                id: 'monk.brewmaster.tipBox.shortCooldownBrews',
                message: 'Short-Cooldown Brews',
              })}
              spells={ROTATIONAL_BREWS}
            />
            <BlackoutComboTipBox />
          </RotationTipBoxRow>
        </SubSection>
        <SubSection title={t({ id: 'monk.brewmaster.subsection.cooldowns', message: 'Cooldowns' })}>
          <Explanation>
            <p>
              <Trans id="monk.brewmaster.cooldowns.description1">
                Cooldowns like <SpellLink spell={spells.INVOKE_NIUZAO_THE_BLACK_OX_TALENT} /> and{' '}
                <SpellLink spell={talents.EXPLODING_KEG_TALENT} /> are a major contributor to your
                overall damage. As a tank, they are also key to establishing threat on pull and when
                new enemies spawn or are pulled.
              </Trans>
            </p>
            <p>
              <Trans id="monk.brewmaster.cooldowns.description2">
                It is generally correct to hold your cooldowns by a small amount in order to line up
                with fight mechanics, so they aren't a part of the overall rotation listed in the
                previous section. However, holding them too long can hurt your damage
                significantly&mdash;especially if you outright skip a cast (shown in{' '}
                <Highlight color="#834c4a">red</Highlight>).
              </Trans>
            </p>
          </Explanation>
          {info.combatant.hasTalent(talents.INVOKE_NIUZAO_THE_BLACK_OX_TALENT) && (
            <>
              <CastEfficiencyBar
                spell={talents.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}
                gapHighlightMode={GapHighlight.FullCooldown}
                useThresholds
              />
            </>
          )}
          {info.combatant.hasTalent(talents.EXPLODING_KEG_TALENT) && (
            <CastEfficiencyBar
              spell={talents.EXPLODING_KEG_TALENT}
              gapHighlightMode={GapHighlight.FullCooldown}
              useThresholds
            />
          )}
          {info.combatant.hasTalent(talents.CHI_BURST_TALENT) && (
            <CastEfficiencyBar
              spell={talents.CHI_BURST_TALENT}
              gapHighlightMode={GapHighlight.FullCooldown}
              useThresholds
            />
          )}
        </SubSection>
        <InvokeNiuzaoSection />
      </Section>
      <MasterOfHarmonySection />
      <MajorDefensivesSection />
      <PreparationSection />
    </>
  );
}

function MasterOfHarmonySection(): JSX.Element | null {
  const aoh = useAnalyzer(AspectOfHarmony);

  if (!aoh || !aoh.active) {
    return null;
  }

  return (
    <Section
      title={t({ id: 'monk.brewmaster.section.masterOfHarmony', message: 'Master of Harmony' })}
    >
      <SpellUsageSubSection
        explanation={
          <>
            <p>
              <Trans id="monk.brewmaster.masterOfHarmony.description1">
                <SpellLink spell={talents.ASPECT_OF_HARMONY_TALENT} /> causes you to accumulate{' '}
                <strong>Vitality</strong> by doing damage. <strong>Vitality</strong> is spent by
                using <SpellLink spell={aoh.activeSpender} /> <em>and then</em> doing damage (or
                healing).
              </Trans>
            </p>
            <p>
              <Trans id="monk.brewmaster.masterOfHarmony.description2">
                This means it is important to use <SpellLink spell={aoh.activeSpender} />{' '}
                periodically <em>even if you aren't taking much damage</em> in order to spend the
                Vitality before you reach the{' '}
                <TooltipElement
                  content={t({
                    id: 'monk.brewmaster.masterOfHarmony.vitalityCap',
                    message: 'Vitality is capped at 100% of your maximum HP.',
                  })}
                >
                  cap.
                </TooltipElement>
              </Trans>
            </p>
          </>
        }
        uses={aoh.uses}
        noCastsTexts={{
          noCastsOverride: (
            <>
              <Trans id="monk.brewmaster.masterOfHarmony.noCasts">
                You did not cast <SpellLink spell={aoh.activeSpender} />. This means you gained
                almost nothing from your Hero Tree!
              </Trans>
            </>
          ),
        }}
        title={t({ id: 'monk.brewmaster.masterOfHarmony.title', message: 'Aspect of Harmony' })}
        castBreakdownSmallText={t({
          id: 'monk.brewmaster.masterOfHarmony.breakdownText',
          message:
            '- These boxes represent each time you spent Vitality, colored by how good the usage was.',
        })}
      />
    </Section>
  );
}

function BlackoutComboTipBox() {
  const blackoutCombo = useAnalyzer(BlackoutCombo);
  const abilityTracker = useAnalyzer(DamageTracker);
  const data = useMemo(() => {
    if (!blackoutCombo || !abilityTracker) {
      return [];
    }

    const data = Object.entries(blackoutCombo.spellsBOCWasUsedOn).map(([spellId, count]) => ({
      spell: Number(spellId),
      amount: count,
      casts: abilityTracker.getAbility(Number(spellId)).casts as number | null,
      type: '',
    }));

    data.push({
      spell: OTHER_SPECIAL_ID,
      type: defineMessage({ id: 'monk.brewmaster.blackoutCombo.other', message: 'Other' }),
      amount: blackoutCombo.blackoutComboBuffs - blackoutCombo.blackoutComboConsumed,
      casts: null,
    });

    return data;
  }, [blackoutCombo, abilityTracker]);

  if (!blackoutCombo || !abilityTracker || !blackoutCombo.active) {
    return null;
  }

  return (
    <div className={styles.rotationTipBox}>
      <header>
        <SpellLink spell={talents.BLACKOUT_COMBO_TALENT} />
      </header>
      <p>
        <Trans id="monk.brewmaster.blackoutCombo.description">
          <SpellLink spell={talents.BLACKOUT_COMBO_TALENT}>BoC</SpellLink> should be spent on{' '}
          <SpellLink spell={SPELLS.TIGER_PALM} /> in virtually all situations. The main exception is
          during <SpellLink spell={talents.INVOKE_NIUZAO_THE_BLACK_OX_TALENT}>Niuzao</SpellLink> as{' '}
          <SpellLink spell={talents.FLURRY_STRIKES_TALENT}>Shado-Pan</SpellLink>, where you may
          ignore <SpellLink spell={talents.BLACKOUT_COMBO_TALENT}>BoC</SpellLink> entirely.
        </Trans>
      </p>
      <div>
        <Table
          ctx={{
            total: blackoutCombo.blackoutComboBuffs,
            max: Math.max.apply(null, Object.values(blackoutCombo.spellsBOCWasUsedOn)),
          }}
          columns={{
            spellName: spellName.withLabels({
              [OTHER_SPECIAL_ID]: (
                <TooltipElement
                  content={t({
                    id: 'monk.brewmaster.blackoutCombo.wastedDescription',
                    message:
                      'Combo buffs that were either overwritten or expired without being consumed.',
                  })}
                >
                  {t({ id: 'monk.brewmaster.blackoutCombo.wasted', message: 'Wasted' })}
                </TooltipElement>
              ),
            }),
            amountBar: amountBar(
              t({ id: 'monk.brewmaster.blackoutCombo.combos', message: 'Combos' }),
            ),
            casts: literalNumberColumn(
              t({ id: 'monk.brewmaster.blackoutCombo.casts', message: 'Casts' }),
              'casts',
            ),
          }}
          data={data}
        />
      </div>
    </div>
  );
}

const ROTATIONAL_SPELLS = [
  SPELLS.BLACKOUT_KICK_BRM,
  talents.KEG_SMASH_TALENT,
  talents.BREATH_OF_FIRE_TALENT,
];

const ROTATIONAL_BREWS = [
  talents.PURIFYING_BREW_TALENT,
  talents.CELESTIAL_BREW_TALENT,
  talents.CELESTIAL_INFUSION_TALENT,
  talents.BLACK_OX_BREW_TALENT,
];

function CastEfficiencyTipBox({
  spells,
  title,
  children: description,
}: {
  spells: Spell[];
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const castEfficiency = useAnalyzer(CastEfficiency);
  const data = useMemo(() => {
    if (!castEfficiency) {
      return [];
    }

    return spells
      .filter((spell) => castEfficiency.getCastEfficiencyForSpell(spell))
      .map((spell) => {
        const eff = castEfficiency.getCastEfficiencyForSpell(spell)!;

        return {
          casts: eff.casts,
          maxCasts: eff.maxCasts,
          cpm: eff.cpm.toFixed(1),
          spell: spell.id,
        };
      });
  }, [spells, castEfficiency]);

  const castEfficiencyColumn: Column<{ casts: number; maxCasts: number }> = useMemo(
    () => ({
      label: defineMessage({
        id: 'monk.brewmaster.castEfficiency.label',
        message: 'Cast Efficiency',
      }),
      expand: true,
      render({ casts, maxCasts }) {
        return (
          <div className={styles.castEfficiencyColumn}>
            <PassFailBar pass={casts} total={maxCasts} />
          </div>
        );
      },
    }),
    [],
  );

  if (!castEfficiency) {
    return null;
  }

  return (
    <div className={styles.rotationTipBox}>
      <header>{title}</header>
      {description && <p>{description}</p>}
      <div>
        <Table
          ctx={{}}
          columns={{
            spellName,
            castEfficiencyColumn,
            casts: literalNumberColumn(
              t({ id: 'monk.brewmaster.castEfficiency.casts', message: 'Casts' }),
              'casts',
            ),
            maxCasts: literalNumberColumn(
              t({ id: 'monk.brewmaster.castEfficiency.maxCasts', message: 'Max Casts' }),
              'maxCasts',
            ),
            cpm: literalNumberColumn(
              t({ id: 'monk.brewmaster.castEfficiency.cpm', message: 'CPM' }),
              'cpm',
            ),
          }}
          data={data}
        />
      </div>
    </div>
  );
}

function ElevatedPurifyTipBox() {
  const castEfficiency = useAnalyzer(CastEfficiency);
  const highTolerance = useAnalyzer(HighTolerance);

  const data = useMemo(() => {
    if (!castEfficiency || !highTolerance?.active) {
      return [];
    }

    const eff = castEfficiency.getCastEfficiencyForSpell(spells.PURIFYING_BREW_TALENT);
    if (!eff) {
      return [];
    }

    return [
      {
        spell: spells.PURIFYING_BREW_TALENT.id,
        casts: eff.casts,
        elevatedCasts: highTolerance.elevatedPurifyCountTotal,
        elevatedCdrMs: highTolerance.elevatedPurifyCdr,
        maxCasts: eff.maxCasts,
      },
    ];
  }, [castEfficiency, highTolerance]);

  const elevatedCdrColumn: Column<{ elevatedCdrMs: number }> = useMemo(
    () => ({
      label: defineMessage({ id: 'monk.brewmaster.elevatedCdr.label', message: 'Elevated CDR' }),
      render({ elevatedCdrMs }) {
        return formatDurationMinSec(elevatedCdrMs / 1000);
      },
      align: 'right',
    }),
    [],
  );

  const castEfficiencyColumn: Column<{ casts: number; maxCasts: number }> = useMemo(
    () => ({
      label: defineMessage({
        id: 'monk.brewmaster.castEfficiency.label',
        message: 'Cast Efficiency',
      }),
      expand: true,
      render({ casts, maxCasts }) {
        return (
          <div className={styles.castEfficiencyColumn}>
            <PassFailBar pass={casts} total={maxCasts} />
          </div>
        );
      },
    }),
    [],
  );

  if (!castEfficiency || !highTolerance?.active) {
    return null;
  }

  return (
    <div className={styles.rotationTipBox}>
      <header>
        {t({ id: 'monk.brewmaster.elevatedPurify.title', message: 'Elevated Purifying Brew' })}
      </header>
      <p>
        <Trans id="monk.brewmaster.elevatedPurify.description">
          This compares <SpellLink spell={spells.PURIFYING_BREW_TALENT} /> casts during{' '}
          <SpellLink spell={SPELLS.ELEVATED_STAGGER_BUFF} /> against your total casts, so you can
          see how many casts gained the extra High Tolerance value.
        </Trans>
      </p>
      <div>
        <Table
          ctx={{}}
          columns={{
            spellName,
            castEfficiencyColumn,
            casts: literalNumberColumn(
              t({ id: 'monk.brewmaster.elevatedPurify.casts', message: 'Casts' }),
              'casts',
            ),
            elevatedCasts: literalNumberColumn(
              t({ id: 'monk.brewmaster.elevatedPurify.elevatedCasts', message: 'Elevated Casts' }),
              'elevatedCasts',
            ),
            elevatedCdrColumn,
            maxCasts: literalNumberColumn(
              t({ id: 'monk.brewmaster.elevatedPurify.maxCasts', message: 'Max Casts' }),
              'maxCasts',
            ),
          }}
          data={data}
        />
      </div>
    </div>
  );
}

function RotationTipBoxRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.rotationTipBoxRow}>{children}</div>;
}
