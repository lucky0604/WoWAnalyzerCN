import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { defineMessage, t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import getFightName from 'common/getFightName';
import { isUnsupportedClassicVersion, wclGameVersionToBranch } from 'game/VERSIONS';
import ActivityIndicator from 'interface/ActivityIndicator';
import makeAnalyzerUrl from 'interface/makeAnalyzerUrl';
import Panel from 'interface/Panel';
import AdvancedLoggingWarning from 'interface/report/AdvancedLoggingWarning';
import RaidCompositionDetails from 'interface/report/RaidCompositionDetails';
import ReportDurationWarning, { MAX_REPORT_DURATION } from 'interface/report/ReportDurationWarning';
import ReportRaidBuffList from 'interface/ReportRaidBuffList';
import Tooltip from 'interface/Tooltip';
import getConfig from 'parser/getConfig';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlayerProvider } from 'interface/report/context/PlayerContext';
import { useReport } from 'interface/report/context/ReportContext';
import { useFight } from 'interface/report/context/FightContext';
import DocumentTitle from 'interface/DocumentTitle';

import PlayerSelection from './PlayerSelection';
import { getPlayerIdFromParam } from 'interface/selectors/url/report/getPlayerId';
import { i18n } from '@lingui/core';
import { PlayerDetails } from 'parser/core/Player';
import Report from 'parser/core/Report';
import { WCLFight } from 'parser/core/Fight';
import { fetchCombatants } from 'common/fetchWclApi';
import { uniqueBy } from 'common/uniqueBy';
import getAverageItemLevel from 'game/getAverageItemLevel';
import ROLES from 'game/ROLES';
import SPECS from 'game/SPECS';
import GameBranch from 'game/GameBranch';
import { normalizedEncounterId } from 'game/raids';
import { CombatantInfoEvent } from 'parser/core/Events';
import { getPlayerNameFromParam } from 'interface/selectors/url/report/getPlayerName';

interface Props {
  children: ReactNode;
}

// CN fork: 上游的 `v2/report/{code}/fight/{id}/players` 端点托管在 wowanalyzer.com 后端，
// 其数据源是国际服 WCL v2，无法解析国服报告码（实测返回 500）。不再请求该端点，
// 改用 WCL v1 数据本地派生玩家列表：combatantinfo 事件携带 specID 与装备（可算 ilvl），
// fights 响应的 friendlies 携带 name/guid/server/region。
const matchSpecFromIcon = (icon: string | undefined, branch: GameBranch) => {
  if (!icon) {
    return undefined;
  }
  const [className, specName] = icon.split('-');
  if (!specName) {
    return undefined;
  }
  return Object.values(SPECS).find(
    (spec) =>
      spec.branch === branch && spec.wclClassName === className && spec.wclSpecName === specName,
  );
};

const roleToString = (role: number | undefined): PlayerDetails['role'] => {
  switch (role) {
    case ROLES.TANK:
      return 'tank';
    case ROLES.HEALER:
      return 'healer';
    default:
      return 'dps';
  }
};

export const derivePlayers = async (report: Report, fight: WCLFight): Promise<PlayerDetails[]> => {
  const branch = wclGameVersionToBranch(report.gameVersion);
  let combatants = (await fetchCombatants(
    report.code,
    fight.start_time,
    fight.end_time,
  )) as CombatantInfoEvent[];
  if (combatants.length === 0 && branch === GameBranch.Classic) {
    // classic 的 RP 处理有时会把战斗开头拆到前一个 dummy fight，combatantinfo 在那里。
    // 重复击杀的 BOSS 编号会被 WCL 加上 50000 偏移，比对前必须归一化
    // （与 report/index.tsx 的同款回退一致）。
    const prevFight = report.fights.find((other) => other.id === fight.id - 1);
    if (
      prevFight &&
      prevFight.boss === 0 &&
      prevFight.originalBoss === normalizedEncounterId(fight.boss)
    ) {
      combatants = (await fetchCombatants(
        report.code,
        prevFight.start_time,
        prevFight.end_time,
      )) as CombatantInfoEvent[];
    }
  }
  const players: PlayerDetails[] = [];
  for (const combatant of uniqueBy(combatants, (combatant) => combatant.sourceID)) {
    const friendly = report.friendlies.find((friendly) => friendly.id === combatant.sourceID);
    if (!friendly) {
      continue;
    }
    // specID 为 -1 表示 WCL 未解析出天赋，仍可从 friendly.icon（"Class-Spec"）匹配；
    // 直接丢弃会让该玩家从选择列表与团队构成里消失。
    const spec =
      (combatant.specID !== -1 ? SPECS[combatant.specID] : undefined) ??
      matchSpecFromIcon(friendly.icon, branch);
    players.push({
      id: friendly.id,
      name: friendly.name,
      guid: friendly.guid,
      server: friendly.server ?? '',
      region: friendly.region ?? '',
      className: spec?.wclClassName ?? friendly.type ?? '',
      specName: spec?.wclSpecName,
      specID: spec?.id ?? 0,
      role: roleToString(spec?.role),
      ilvl: combatant.gear ? getAverageItemLevel(combatant.gear) : undefined,
    });
  }
  return players;
};

const PlayerLoader = ({ children }: Props) => {
  const { report: selectedReport } = useReport();
  const { fight: selectedFight } = useFight();
  const { player: playerParam } = useParams();
  const playerId = getPlayerIdFromParam(playerParam);
  const playerName = getPlayerNameFromParam(playerParam);
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerDetails[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isUnsupportedClassicVersion(selectedReport.gameVersion)) {
      return;
    }
    let cancelled = false;
    setPlayers(null);
    setError(null);
    derivePlayers(selectedReport, selectedFight)
      .then((derived) => {
        if (!cancelled) {
          setPlayers(derived);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedReport, selectedFight]);

  // re-routing for accesses with player name but no id. if exact match, route to id.
  // if no exact match (missing or multiple matches) reroute to player selection.
  //
  // would like everything to have the id, but there are a lot of urls floating around with name only
  useEffect(() => {
    if (playerName && !playerId && players) {
      const namedPlayers = players.filter((player) => player.name === playerName);

      if (namedPlayers.length === 1) {
        navigate(makeAnalyzerUrl(selectedReport, selectedFight.id, namedPlayers[0].id), {
          replace: true,
        });
      } else {
        navigate(makeAnalyzerUrl(selectedReport, selectedFight.id), {
          replace: true,
        });
      }
    }
  }, [playerId, playerName, players, selectedReport, selectedFight, navigate]);

  const player = useMemo(
    () => players?.find((player) => player.id === playerId),
    [players, playerId],
  );

  const composition = useMemo(() => {
    const result = {
      tank: 0,
      dps: 0,
      healer: 0,
      ilvl: 0,
    };

    if (!players) {
      return result;
    }

    for (const player of players) {
      result.ilvl += player.ilvl ?? 0;
      result[player.role] += 1;
    }

    result.ilvl /= players.length;

    return result;
  }, [players]);

  if (isUnsupportedClassicVersion(selectedReport.gameVersion)) {
    return (
      <div className="container offset">
        <Panel
          title={t({
            id: 'interface.report.oldLogWarning.title',
            message: 'Unsupported encounters detected',
          })}
        >
          <div className="flex wrapable">
            <div className="flex-main" style={{ minWidth: 400 }}>
              <Trans id="interface.report.oldLogWarning.details">
                The current report contains encounters from an old World of Warcraft expansion. Old
                expansion logs are not supported.
              </Trans>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (error) {
    // TODO: i18n
    return (
      <div className="container offset">
        <Panel
          title={t({
            id: 'interface.report.render.playerListError',
            message: '出了点问题',
          })}
        >
          <div className="flex wrapable">
            <div className="flex-main">
              <Trans id="interface.report.render.playerListErrorDetails">
                加载玩家列表时发生意外错误。
              </Trans>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (!players) {
    return (
      <ActivityIndicator
        text={t({
          id: 'interface.report.renderLoading.fetchingPlayerInfo',
          message: `Fetching player info...`,
        })}
      />
    );
  }

  const reportDuration = selectedReport.end - selectedReport.start;

  const config =
    player &&
    getConfig(wclGameVersionToBranch(selectedReport.gameVersion), player.specID ?? 0, player);

  if (playerId && (!player || !config)) {
    if (!player) {
      alert(
        i18n._(
          defineMessage({
            id: 'interface.report.render.dataNotAvailable',
            message: `Player data does not seem to be available for the selected player in this fight.`,
          }),
        ),
      );
    } else if (!config) {
      alert(
        i18n._(
          defineMessage({
            id: 'interface.report.render.notSupported',
            message: `This spec is not supported for this expansion.`,
          }),
        ),
      );
    }
  }

  if (!player) {
    return (
      <main className="container offset">
        <div style={{ position: 'relative', marginBottom: 15 }}>
          <div className="back-button">
            <Tooltip
              content={t({
                id: 'interface.report.render.backToFightSelection',
                message: `Back to fight selection`,
              })}
            >
              <Link to={`/report/${selectedReport.code}`}>
                <span className="glyphicon glyphicon-chevron-left" aria-hidden="true" />
                <label>
                  {' '}
                  {t({
                    id: 'interface.report.render.labelFightSelection',
                    message: 'Fight selection',
                  })}
                </label>
              </Link>
            </Tooltip>
          </div>
          <div className="flex wrapable" style={{ marginBottom: 15 }}>
            <div className="flex-main">
              <h1 style={{ lineHeight: 1.4, margin: 0 }}>
                {t({ id: 'interface.report.render.playerSelection', message: 'Player selection' })}
              </h1>
              <small style={{ marginTop: -5 }}>
                <Trans id="interface.report.render.playerSelectionDetails">
                  Select the player you wish to analyze.
                </Trans>
              </small>
            </div>
            <div className="flex-sub">
              <RaidCompositionDetails
                tanks={composition.tank}
                healers={composition.healer}
                dps={composition.dps}
                ilvl={composition.ilvl}
              />
            </div>
          </div>
        </div>

        {selectedFight.end_time > MAX_REPORT_DURATION && (
          <ReportDurationWarning duration={reportDuration} />
        )}

        {players.length === 0 && <AdvancedLoggingWarning />}

        <PlayerSelection
          report={selectedReport}
          players={players}
          makeUrl={(playerId) =>
            makeAnalyzerUrl(selectedReport, selectedFight.id, playerId, undefined)
          }
        />
        <ReportRaidBuffList report={selectedReport} players={players} />
      </main>
    );
  }

  return (
    <>
      <DocumentTitle
        title={t({
          id: 'interface.report.render.documentTitle',
          message: `${getFightName(selectedReport, selectedFight)} by ${player.name} in ${
            selectedReport.title
          }`,
        })}
      />

      <PlayerProvider player={player} allPlayers={players}>
        {children}
      </PlayerProvider>
    </>
  );
};

export default PlayerLoader;
