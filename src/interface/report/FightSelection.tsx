import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import getFightName from 'common/getFightName';
import makeAnalyzerUrl from 'interface/makeAnalyzerUrl';
import OldExpansionWarning from 'interface/report/OldExpansionWarning';
import FightSelectionPanel from 'interface/report/FightSelectionPanel';
import ReportDurationWarning, { MAX_REPORT_DURATION } from 'interface/report/ReportDurationWarning';
import Tooltip from 'interface/Tooltip';
import { ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Toggle from 'interface/react-toggle';
import { FightProvider } from 'interface/report/context/FightContext';
import { useReport } from 'interface/report/context/ReportContext';
import { isUnsupportedClassicVersion } from 'game/VERSIONS';
import DocumentTitle from 'interface/DocumentTitle';
import { getFightIdFromParam } from 'interface/selectors/url/report/getFightId';
import { usePageView } from 'interface/useGoogleAnalytics';
import { isPresent } from 'common/typeGuards';
import { useWaDispatch } from 'interface/utils/useWaDispatch';
import { clearFight, setFight } from 'interface/reducers/navigation';
import type { WCLFight } from 'parser/core/Fight';
import type Report from 'parser/core/Report';
import { useLingui } from '@lingui/react';
import { isEligibleFight } from 'common/isEligibleFight';
import ReportNoEligibleFightsWarning from 'interface/report/ReportNoEligibleFightsWarning';
import ReportFightNotEligibleWarning from 'interface/report/ReportFightNotEligibleWarning';

import Panel from 'interface/Panel';

/**
 * Keep the dungeon catalog out of the report's initial bundle. The bridge is
 * loaded only after a fight has been selected, and it renders only when the
 * WCL adapter finds a formally available dungeon document.
 */
const DungeonLearningBridge = ({ report, fight }: { report: Report; fight: WCLFight }) => {
  const [learningPath, setLearningPath] = useState<string>();

  useEffect(() => {
    let active = true;
    setLearningPath(undefined);
    void import('../../dungeon/runtime/wcl')
      .then(({ getPublishedDungeonLearningPathFromWcl }) => {
        if (active) {
          setLearningPath(getPublishedDungeonLearningPathFromWcl(report, fight));
        }
      })
      .catch(() => {
        // The report must remain usable when the optional dungeon chunk fails.
      });
    return () => {
      active = false;
    };
  }, [fight, report]);

  if (!learningPath) return null;

  return (
    <div className="container offset">
      <Panel
        title="大秘境学习"
        subheading
        explanation="WCL 已识别当前日志所属副本；攻略内容与日志分析保持独立。"
      >
        <p>先复习路线、怪物技能和每个场景的可执行动作，再回到日志分析核对表现。</p>
        <Link className="btn btn-primary" to={learningPath}>
          查看副本攻略 →
        </Link>
      </Panel>
    </div>
  );
};

const getFightFromReport = (report: Report, fightId: number) => {
  if (!report.fights) {
    return null;
  }
  return report.fights.find((fight) => fight.id === fightId) || null;
};

interface Props {
  children: ReactNode;
}

const FightSelectionList = () => {
  const [killsOnly, setKillsOnly] = useState(false);
  const { report, refreshReport } = useReport();
  const reportDuration = report.end - report.start;
  const { i18n } = useLingui();
  usePageView('FightSelectionList');

  return (
    <main className="container offset fight-selection">
      <div className="flex wrapable" style={{ marginBottom: 15 }}>
        <div className="flex-main" style={{ position: 'relative' }}>
          <div className="back-button">
            <Tooltip
              content={i18n._({
                id: 'interface.report.fightSelection.tooltip.backToHome',
                message: `Back to home`,
              })}
            >
              <Link to="/">
                <span className="glyphicon glyphicon-chevron-left" aria-hidden="true" />
                <label>
                  {' '}
                  {t({ id: 'interface.report.fightSelection.tooltip.home', message: 'Home' })}
                </label>
              </Link>
            </Tooltip>
          </div>
          <h1 style={{ lineHeight: 1.4, margin: 0 }}>
            {t({
              id: 'interface.report.fightSelection.fightSelection',
              message: 'Fight selection',
            })}
          </h1>
          <small style={{ marginTop: -5 }}>
            <Trans id="interface.report.fightSelection.fightSelectionDetails">
              Select the fight you wish to analyze. If a boss or encounter is missing, or the list
              below is empty, press the Refresh button above to re-pull the log from Warcraft Logs.
              Additionally, please note that due to the way combat logs work, we are unable to
              evaluate Target Dummy logs.
            </Trans>
          </small>
        </div>
        <div className="flex-sub">
          <div>
            <Tooltip
              content={
                <Trans id="interface.report.fightSelection.tooltip.refreshFightsList">
                  This will refresh the fights list which can be useful if you're live logging.
                </Trans>
              }
            >
              <Link to={makeAnalyzerUrl(report)} onClick={refreshReport}>
                <span className="glyphicon glyphicon-refresh" aria-hidden="true" />{' '}
                {t({ id: 'interface.report.fightSelection.refresh', message: 'Refresh' })}
              </Link>
            </Tooltip>
            <span className="toggle-control" style={{ marginLeft: 5 }}>
              <Toggle
                checked={killsOnly}
                icons={false}
                onChange={(event) => setKillsOnly(event.currentTarget.checked)}
                id="kills-only-toggle"
              />
              <label htmlFor="kills-only-toggle">
                {' '}
                {t({ id: 'interface.report.fightSelection.killsOnly', message: 'Kills only' })}
              </label>
            </span>
          </div>
        </div>
      </div>

      {isUnsupportedClassicVersion(report.gameVersion) && <OldExpansionWarning />}

      {reportDuration > MAX_REPORT_DURATION && <ReportDurationWarning duration={reportDuration} />}

      {!isUnsupportedClassicVersion(report.gameVersion) && (
        <FightSelectionPanel report={report} killsOnly={killsOnly} />
      )}
    </main>
  );
};

const FightSelection = ({ children }: Props) => {
  const { fightId } = useParams();
  const fightIdAsNumber = getFightIdFromParam(fightId);
  const { report } = useReport();
  const dispatch = useWaDispatch();
  const { i18n } = useLingui();

  const eligibleFights = report.fights.filter(isEligibleFight);
  const fight = isPresent(fightIdAsNumber) ? getFightFromReport(report, fightIdAsNumber) : null;

  useEffect(() => {
    if (fight) {
      dispatch(
        setFight({ title: getFightName(report, fight), link: makeAnalyzerUrl(report, fight.id) }),
      );
    } else {
      dispatch(clearFight());
    }
  }, [dispatch, fight, report]);

  useEffect(() => {
    // Scroll to top of page on initial render
    window.scrollTo(0, 0);
  }, []);

  if (!fight) {
    if (eligibleFights.length === 0) {
      return <ReportNoEligibleFightsWarning />;
    }
    return <FightSelectionList />;
  }

  if (!isEligibleFight(fight)) {
    return <ReportFightNotEligibleWarning />;
  }

  return (
    <>
      <DocumentTitle
        title={
          fight
            ? i18n._({
                id: 'interface.report.fightSelection.documentTitle',
                message: '{name} in {title}',
                values: {
                  name: getFightName(report, fight),
                  title: report.title,
                },
              })
            : report.title
        }
      />
      <FightProvider fight={fight}>
        <DungeonLearningBridge report={report} fight={fight} />
        {children}
      </FightProvider>
    </>
  );
};

export default FightSelection;
