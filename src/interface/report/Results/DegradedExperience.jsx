import AlertDanger from 'interface/AlertDanger';
import ModuleError from 'parser/core/ModuleError';
import PropTypes from 'prop-types';
import { Component, Fragment } from 'react';

const toTitleCase = (s) => s.substr(0, 1).toUpperCase() + s.substr(1);

class DegradedExperience extends Component {
  static propTypes = {
    disabledModules: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      expanded: false,
    };
    this.toggleDetails = this.toggleDetails.bind(this);
  }

  toggleDetails() {
    this.setState((state) => ({ expanded: !state.expanded }));
  }

  get firstError() {
    const { disabledModules } = this.props;
    const existingErrorTypes = Object.values(ModuleError).filter(
      (state) => disabledModules[state] && disabledModules[state].length !== 0,
    );
    if (existingErrorTypes.length > 0) {
      return disabledModules[existingErrorTypes[0]][0].key;
    }
    return '';
  }

  get disabledModuleCount() {
    const { disabledModules } = this.props;
    let amount = 0;
    if (disabledModules) {
      amount = Object.values(ModuleError).reduce((total, cur) => {
        if (cur === ModuleError.DEPENDENCY) {
          //dont count dependency errors for total
          return total;
        }
        return total + (disabledModules[cur] ? disabledModules[cur].length : 0);
      }, 0);
    }
    return amount;
  }

  get disabledDependencyCount() {
    const { disabledModules } = this.props;
    if (disabledModules[ModuleError.DEPENDENCY]) {
      return disabledModules[ModuleError.DEPENDENCY].length;
    }
    return 0;
  }

  render() {
    const { disabledModules } = this.props;
    if (this.disabledModuleCount === 0) {
      return null;
    }

    return (
      <div className="container">
        <AlertDanger style={{ marginBottom: 30 }}>
          <h2>分析体验受损</h2>
          <span style={{ color: 'white' }}>{toTitleCase(this.firstError)}</span>{' '}
          {this.disabledModuleCount > 1 && (
            <>
              及其他 {this.disabledModuleCount - 1} 个模块{' '}
            </>
          )}
          遇到错误并已被禁用。{' '}
          {this.disabledDependencyCount > 1 && (
            <>
              因此另有{' '}
              <span style={{ color: 'white' }}>{this.disabledDependencyCount}</span> 个依赖模块也被禁用。
            </>
          )}{' '}
          分析结果可能不完整。请在{' '}
          <a href="https://wowanalyzer.com/discord">Discord</a> 上向我们反馈此问题！{' '}
          <a href="#" onClick={this.toggleDetails}>
            {this.state.expanded ? '收起详情' : '查看详情'}
          </a>
          {this.state.expanded && (
            <>
              {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
              <br />
              {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
              <br />
              {Object.values(ModuleError)
                .filter((state) => disabledModules[state] && disabledModules[state].length !== 0)
                .map((state) => (
                  <div key={state}>
                    {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                    以下模块因在 {state} 阶段出错而被禁用：<br />
                    <div style={{ color: 'white' }}>
                      {disabledModules[state]
                        .sort((a, b) => a.key.localeCompare(b.key))
                        .map((m) => (
                          <Fragment key={m.key}>
                            {toTitleCase(m.key)}
                            {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                            <br />
                            {m.error && (
                              <pre>{m.error.stack ? m.error.stack : m.error.toString()}</pre>
                            )}
                          </Fragment>
                        ))}
                    </div>
                    {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                    <br />
                  </div>
                ))}
            </>
          )}
        </AlertDanger>
      </div>
    );
  }
}

export default DegradedExperience;
