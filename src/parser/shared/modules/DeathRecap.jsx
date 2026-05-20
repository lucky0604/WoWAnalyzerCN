import { formatDuration, formatNumber, formatPercentage } from 'common/format';
import { Icon, SpellIcon, SpellLink, Tooltip, TooltipElement } from 'interface';
import WarcraftLogsIcon from 'interface/icons/WarcraftLogs';
import { EventType } from 'parser/core/Events';
import PropTypes from 'prop-types';
import Slider from 'rc-slider';
import { PureComponent, Fragment } from 'react';

import 'rc-slider/assets/index.css';

const SHOW_SECONDS_BEFORE_DEATH = 10;
const AMOUNT_THRESHOLD = 0;

class DeathRecap extends PureComponent {
  static propTypes = {
    events: PropTypes.array.isRequired,
    enemies: PropTypes.object.isRequired,
    combatants: PropTypes.object.isRequired,
    report: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      detailedView: 0,
      amountThreshold: AMOUNT_THRESHOLD,
    };
    this.handleClick = this.handleClick.bind(this);
    this.filterDeath = this.filterDeath.bind(this);
  }

  handleClick(event) {
    const clicked = event === this.state.detailedView ? -1 : event;
    this.setState({ detailedView: clicked });
  }

  filterDeath(event, i) {
    const start =
      this.props.report.fight.offset_time +
      (i !== 0 && this.props.events[i - 1].deathtime - this.props.report.fight.start_time);
    const end =
      event.deathtime + this.props.report.fight.offset_time - this.props.report.fight.start_time;
    this.props.report.applyTimeFilter(start, end);
  }

  render() {
    let lastHitPoints = 0;
    let lastMaxHitPoints = 0;

    function sortByTimelineIndex(a, b) {
      return a.timelineSortIndex - b.timelineSortIndex;
    }

    const sliderProps = {
      min: 0,
      max: 0.5,
      step: 0.05,
      marks: {
        0: '0%',
        0.05: '5%',
        0.1: '10%',
        0.15: '15%',
        0.2: '20%',
        0.25: '25%',
        0.3: '30%',
        0.35: '35%',
        0.4: '40%',
        0.45: '45%',
        0.5: '50%',
      },
      style: {
        margin: '0 5px',
      },
    };

    const events = this.props.events;

    return (
      <>
        <div className="pad" style={{ marginBottom: 15 }}>
          <div className="row">
            <div className="col-md-8">
              <div>按最小数值筛选事件（玩家生命值的百分比）：</div>
              <Slider
                {...sliderProps}
                defaultValue={this.state.amountThreshold}
                onChange={(value) => {
                  this.setState({
                    amountThreshold: value,
                  });
                }}
              />
            </div>
            <div className="col-md-4">
              <Tooltip content="在 Warcraft Logs 上查看死亡记录">
                <a
                  href={`https://www.warcraftlogs.com/reports/${this.props.report.report.code}#fight=${this.props.report.fight.id}&type=deaths&source=${this.props.report.player.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ fontSize: 24 }}
                >
                  <WarcraftLogsIcon /> Warcraft Logs
                </a>
              </Tooltip>
            </div>
          </div>
        </div>
        {events.map((death, i) => (
          <Fragment key={i}>
            <div style={{ display: 'block' }}>
              <h2
                onClick={() => this.handleClick(i)}
                style={{ padding: '10px 20px', cursor: 'pointer', display: 'inline-block' }}
              >
                死亡 #{i + 1}
              </h2>
              <TooltipElement content="筛选此时间段内的事件：从战斗开始或你上一次死亡（以较晚者为准）到此次死亡。">
                <a href="#" onClick={() => this.filterDeath(death, i)}>
                  筛选之前的事件
                </a>
              </TooltipElement>
            </div>
            <table
              style={{ display: this.state.detailedView === i ? 'block' : 'none' }}
              className="data-table"
            >
              <thead>
                <tr>
                  <th>时间</th>
                  <th>技能</th>
                  <th>生命值</th>
                  <th>数值</th>
                  <th>减伤增益/减益</th>
                  <th>可用个人减伤</th>
                </tr>
              </thead>
              <tbody>
                {death.events
                  .filter(
                    (e) =>
                      e.timestamp <= death.deathtime &&
                      e.timestamp >= death.deathtime - SHOW_SECONDS_BEFORE_DEATH * 1000,
                  )
                  .filter(
                    (e) =>
                      (e.amount + (e.absorbed || 0)) / e.maxHitPoints >
                        this.state.amountThreshold || e.type === EventType.Instakill,
                  )
                  .map((event, eventIndex) => {
                    if (event.hitPoints && event.maxHitPoints) {
                      lastHitPoints = event.hitPoints;
                      lastMaxHitPoints = event.maxHitPoints;
                    }

                    const hitPercent = event.amount / lastMaxHitPoints;
                    let percent = 0;
                    let output = null;
                    //name = either NPC-Name > sourceID-Name > Ability-Name as fallback
                    let sourceName =
                      event.source && event.source.type === 'NPC' ? event.source.name : null;
                    if (!sourceName && event.type === EventType.Heal) {
                      sourceName = this.props.combatants[event.sourceID]?.name ?? null;
                    }
                    if (!sourceName && event.type === EventType.Damage) {
                      sourceName = this.props.enemies[event.sourceID]?.name ?? null;
                    }
                    if (!sourceName && event.type !== EventType.Instakill) {
                      sourceName = event.ability.name;
                    }

                    if (event.type === EventType.Heal) {
                      percent = (lastHitPoints - event.amount) / lastMaxHitPoints;
                      output = (
                        <TooltipElement
                          content={
                            <>
                              {event.sourceID === event.targetID
                                ? `你为自己治疗了 ${formatNumber(event.amount)}`
                                : `${sourceName} 为你治疗了 ${formatNumber(event.amount)}`}
                              {event.absorbed > 0
                                ? `，其中 ${formatNumber(event.absorbed)} 被吸收`
                                : ''}
                              {event.overheal > 0
                                ? `，过量治疗了 ${formatNumber(event.overheal)}`
                                : ''}
                            </>
                          }
                          style={
                            event.amount === 0 && event.absorbed > 0
                              ? { color: 'orange' }
                              : { color: 'green' }
                          }
                        >
                          +{formatNumber(event.amount)}{' '}
                          {event.absorbed > 0 ? `(A: ${formatNumber(event.absorbed)} )` : ''}{' '}
                          {event.overheal > 0 ? `(O: ${formatNumber(event.overheal)} )` : ''}
                        </TooltipElement>
                      );
                    } else if (event.type === EventType.Damage) {
                      percent = lastHitPoints / lastMaxHitPoints;
                      output = (
                        <TooltipElement
                          content={
                            <>
                              {event.sourceID === event.targetID
                                ? `你对自己造成了 ${formatNumber(event.amount)} 伤害`
                                : `${sourceName} 总共对你造成了 ${formatNumber(
                                    event.amount + (event.absorbed || 0),
                                  )} 伤害`}
                              {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                              <br />
                              {event.absorbed > 0 ? (
                                <>
                                  {formatNumber(event.absorbed)} 被吸收，你受到了{' '}
                                  {formatNumber(event.amount)} 伤害
                                  {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                                  <br />
                                </>
                              ) : (
                                ''
                              )}
                            </>
                          }
                          style={{ color: 'red' }}
                        >
                          -{formatNumber(event.amount)}{' '}
                          {event.absorbed > 0 ? `(A: ${formatNumber(event.absorbed)} )` : ''}
                        </TooltipElement>
                      );
                    } else if (event.type === EventType.Instakill) {
                      percent = 0;
                      output = '秒杀';
                    }

                    if (event.overkill || event.hitPoints === 0) {
                      percent = 0;
                    }

                    return (
                      <tr key={eventIndex}>
                        <td style={{ width: '5%' }}>
                          {formatDuration(event.time + this.props.report.fight.offset_time, 2)}
                        </td>
                        <td style={{ width: '20%' }}>
                          <SpellLink spell={event.ability.guid} icon={false}>
                            <Icon icon={event.ability.abilityIcon} />
                          </SpellLink>
                        </td>
                        <td style={{ width: '20%' }}>
                          <div className="flex performance-bar-container">
                            {percent !== 0 && (
                              <div
                                className="flex-sub performance-bar"
                                style={{ color: 'white', width: formatPercentage(percent) + '%' }}
                              />
                            )}
                            <div
                              className="flex-sub performance-bar"
                              style={{
                                backgroundColor: event.type === EventType.Heal ? 'green' : 'red',
                                width: formatPercentage(hitPercent) + '%',
                                opacity: event.type === EventType.Heal ? 0.8 : 0.4,
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ width: '15%' }}>{output}</td>
                        <td style={{ width: '20%' }}>
                          {event.buffsUp &&
                            event.buffsUp
                              .sort(sortByTimelineIndex)
                              .map((e) => (
                                <SpellIcon
                                  key={e.id}
                                  style={{ border: '1px solid rgba(0, 0, 0, 0)' }}
                                  spell={e.id}
                                />
                              ))}
                          {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                          <br />
                          {event.debuffsUp &&
                            event.debuffsUp
                              .sort(sortByTimelineIndex)
                              .map((e) => (
                                <SpellIcon
                                  key={e.id}
                                  style={{ border: '1px solid red' }}
                                  spell={e.id}
                                />
                              ))}
                        </td>
                        <td style={{ width: '20%' }}>
                          {event.defensiveCooldowns.sort(sortByTimelineIndex).map((e) => (
                            <SpellIcon
                              key={e.id}
                              style={{ opacity: e.cooldownReady ? 1 : 0.2 }}
                              spell={e.id}
                            />
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                <tr>
                  <td />
                  <td colSpan="6">你死了</td>
                </tr>
              </tbody>
            </table>
          </Fragment>
        ))}
      </>
    );
  }
}

export default DeathRecap;
