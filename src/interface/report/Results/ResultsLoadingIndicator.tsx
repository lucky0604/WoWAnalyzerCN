import BOSS_PHASES_STATE from 'interface/report/BOSS_PHASES_STATE';
import EVENT_PARSING_STATE from 'interface/report/EVENT_PARSING_STATE';
import Panel from 'interface/Panel';
import LoadingBar from 'interface/LoadingBar';
import { useResults } from 'interface/report/Results/ResultsContext';

const ResultsLoadingIndicator = () => {
  const {
    loadingStatus: {
      progress,
      isLoadingParser,
      isLoadingEvents,
      bossPhaseEventsLoadingState,
      isLoadingCharacterProfile,
      isLoadingPhases,
      isFilteringEvents,
      parsingState,
    },
  } = useResults();

  return (
    <div className="container" style={{ marginBottom: 40 }}>
      <Panel title="加载中..." className="loading-indicators">
        <LoadingBar progress={progress} style={{ marginBottom: 30 }} />

        <div className="row">
          <div className="col-md-8">WoWAnalyzer 专精分析器</div>
          <div className={`col-md-4 ${isLoadingParser ? 'loading' : 'ok'}`}>
            {isLoadingParser ? '加载中...' : '完成'}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">从 Warcraft Logs 获取玩家事件</div>
          <div className={`col-md-4 ${isLoadingEvents ? 'loading' : 'ok'}`}>
            {isLoadingEvents ? '加载中...' : '完成'}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">从 Warcraft Logs 获取 Boss 事件</div>
          <div
            className={`col-md-4 ${
              bossPhaseEventsLoadingState === BOSS_PHASES_STATE.LOADING
                ? 'loading'
                : bossPhaseEventsLoadingState === BOSS_PHASES_STATE.SKIPPED
                  ? 'skipped'
                  : 'ok'
            }`}
          >
            {bossPhaseEventsLoadingState === BOSS_PHASES_STATE.SKIPPED && '已跳过'}
            {bossPhaseEventsLoadingState === BOSS_PHASES_STATE.LOADING && '加载中...'}
            {bossPhaseEventsLoadingState === BOSS_PHASES_STATE.DONE && '完成'}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">从暴雪获取角色信息</div>
          <div className={`col-md-4 ${isLoadingCharacterProfile ? 'loading' : 'ok'}`}>
            {isLoadingCharacterProfile ? '加载中...' : '完成'}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">分析战斗阶段</div>
          <div className={`col-md-4 ${isLoadingPhases ? 'loading' : 'ok'}`}>
            {isLoadingPhases ? '加载中...' : '完成'}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">筛选事件</div>
          <div className={`col-md-4 ${isFilteringEvents ? 'loading' : 'ok'}`}>
            {isFilteringEvents ? '加载中...' : '完成'}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">分析事件</div>
          <div
            className={`col-md-4 ${
              parsingState === EVENT_PARSING_STATE.WAITING
                ? 'waiting'
                : parsingState === EVENT_PARSING_STATE.PARSING
                  ? 'loading'
                  : 'ok'
            }`}
          >
            {parsingState === EVENT_PARSING_STATE.WAITING && '等待中'}
            {parsingState === EVENT_PARSING_STATE.PARSING && '加载中...'}
            {parsingState === EVENT_PARSING_STATE.DONE && '完成'}
          </div>
        </div>
      </Panel>
    </div>
  );
};
export default ResultsLoadingIndicator;
