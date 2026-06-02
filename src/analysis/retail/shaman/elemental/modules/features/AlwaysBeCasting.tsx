import { Expandable } from 'interface';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { SectionHeader, SubSection } from 'interface/guide';
import { ThresholdStyle } from 'parser/core/ParseResults';
import CoreAlwaysBeCasting from 'parser/shared/modules/AlwaysBeCasting';
import ThresholdPerformancePercentage from './shared/ThresholdPerformancePercentage';
import Statistics from 'interface/icons/Statistics';
import ActiveTimeGraph from 'parser/ui/ActiveTimeGraph';

class AlwaysBeCasting extends CoreAlwaysBeCasting {
  get suggestionThresholds() {
    return {
      actual: this.activeTimePercentage,
      isLessThan: {
        minor: 0.95,
        average: 0.85,
        major: 0.75,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get guideSubsection() {
    const abcSuggestionThreshold = this.suggestionThresholds;

    return (
      <SubSection title={t({ id: 'shaman.elemental.abc.title', message: 'Always be casting' })}>
        <p>
          <Trans id="shaman.elemental.abc.explanation">
            As long as you have a target, there is <strong>always</strong> something you can cast as
            an Elemental shaman. This means that you should try to be on global cooldown for as much
            as you possibly can throughout the entire encounter. Any time you are not casting is
            time that you are not doing damage.
          </Trans>
        </p>

        <p>
          <Trans id="shaman.elemental.abc.positioning">
            A key factor to achieving high uptime as a caster is correct positioning and movement.
            Throughout the fight, it is very important that you proactively anticipate where you
            need to stand and/or move for mechanics. Doing this properly will minimize forced
            downtime of having to move longer distances.
          </Trans>
        </p>

        <p>
          <Trans id="shaman.elemental.abc.percent">
            You spent{' '}
            <ThresholdPerformancePercentage
              threshold={{
                type: 'gte',
                perfect: abcSuggestionThreshold.isLessThan.minor,
                good: abcSuggestionThreshold.isLessThan.average,
                ok: abcSuggestionThreshold.isLessThan.major,
              }}
              percentage={this.activeTimePercentage}
            />{' '}
            of the encounter in global cooldown.
          </Trans>
        </p>

        <small>
          <Trans id="shaman.elemental.abc.intermissions">
            There will be some time where you cannot cast, for example during intermissions. You
            should evaluate your performance based on fight specific mechanics.
          </Trans>
        </small>

        <Expandable
          header={
            <SectionHeader>
              <Statistics />{' '}
              {t({ id: 'shaman.elemental.abc.graph', message: 'Active time timeline graph' })}
            </SectionHeader>
          }
          element="section"
        >
          <ActiveTimeGraph
            activeTimeSegments={this.activeTimeSegments}
            fightStart={this.owner.fight.start_time}
            fightEnd={this.owner.fight.end_time}
          />
        </Expandable>
      </SubSection>
    );
  }
}

export default AlwaysBeCasting;
