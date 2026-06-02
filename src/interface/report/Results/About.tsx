import { Plural, Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import isLatestPatch from 'game/isLatestPatch';
import AlertInfo from 'interface/AlertInfo';
import AlertWarning from 'interface/AlertWarning';
import Contributor from 'interface/ContributorButton';
import DiscordButton from 'interface/DiscordButton';
import Panel from 'interface/Panel';
import ReadableListing from 'interface/ReadableListing';
import FoundationSupportBadge from 'interface/guide/foundation/FoundationSupportBadge';
import Config, { SupportLevel } from 'parser/Config';
import { Link } from 'react-router-dom';

interface Props {
  config: Config;
}

const About = ({ config }: Props) => {
  const { spec, contributors, patchCompatibility, supportLevel } = config;
  const { i18n } = useLingui();
  const isPartial = supportLevel === SupportLevel.MaintainedPartial;
  const contributorinfo =
    contributors.length !== 0
      ? contributors.map((contributor) => (
          <Contributor key={contributor.nickname} {...contributor} />
        ))
      : defineMessage({ id: 'interface.report.results.about.unmaintained', message: 'CURRENTLY UNMAINTAINED' });

  const description = config.description ?? <DefaultDescription {...config} />;

  return (
    <Panel
      title={
        <Trans id="interface.report.results.about.aboutSpecnameClassname">
          About {spec.specName && i18n._(spec.specName)} {i18n._(spec.className)}
        </Trans>
      }
      actions={
        <>
          <div>
            <Link to="../events">
              {t({ id: 'interface.report.results.about.viewEvents', message: 'View all events' })}
            </Link>
          </div>
          <div>
            <Link to="../debug">
              {t({ id: 'interface.report.results.about.viewDebug', message: 'View debug info' })}
            </Link>
          </div>
        </>
      }
    >
      {description}

      <div className="row" style={{ marginTop: '1em' }}>
        <div className="col-lg-4" style={{ fontWeight: 'bold', paddingRight: 0 }}>
          <Plural
            id="common.about.contributor"
            value={contributors.length}
            one="Contributor"
            other="Contributors"
          />
        </div>
        <div className="col-lg-8">
          <ReadableListing>{contributorinfo}</ReadableListing>
        </div>
      </div>
      <div className="row" style={{ marginTop: '0.5em' }}>
        <div className="col-lg-4" style={{ fontWeight: 'bold', paddingRight: 0 }}>
          {t({
            id: 'interface.report.results.about.updatedForPatch',
            message: 'Updated for patch',
          })}
        </div>
        <div className="col-lg-8">{patchCompatibility}</div>
      </div>
      {!isLatestPatch(config) && (
        <AlertWarning style={{ marginTop: '1em' }}>
          <Trans id="interface.report.results.about.outdated">
            The analysis for this spec is outdated. Analysis for spells that were changed after
            patch {patchCompatibility} may be inaccurate.
          </Trans>
        </AlertWarning>
      )}
      {isPartial && (
        <AlertWarning style={{ marginTop: '1em' }}>
          <Trans id="interface.report.results.about.isPartial">
            The analysis for this spec is incomplete. Important elements may be missing or some
            features lack sufficient accuracy.
          </Trans>
        </AlertWarning>
      )}
    </Panel>
  );
};

const DefaultDescription = ({ spec, supportLevel }: Config) => {
  const i18n = useLingui();

  const specTitle = (
    <>
      {spec.specName && i18n._(spec.specName)} {i18n._(spec.className)}
    </>
  );

  // FIXME: this is not fully i18n'd because of an issue with transing the larger text
  const supportDesc =
    supportLevel === SupportLevel.Foundation ? (
      <>
        <p>
          {specTitle} 具有 <FoundationSupportBadge />
          ，包括：
        </p>
        <ul>
          <li>技能使用和覆盖率的综合分析（始终保持施法！）</li>
          <li>所有职业和专精技能的精确冷却追踪</li>
        </ul>
        <p>然而，该分析器没有专门的维护者提供详细的循环分析、统计数据或其他功能。</p>
        <p>
          如果你认为存在技能或冷却追踪方面的错误，请通过 <SmallDiscordButton /> 告知我们。
        </p>
      </>
    ) : (
      <p>
        <Trans id="interface.report.results.about.unmaintainedDescription">
          {specTitle} is not currently maintained.
        </Trans>
      </p>
    );

  return (
    <div>
      {supportDesc}
      <AlertInfo>
        有兴趣为 {specTitle} 分析做出贡献？请查看我们的{' '}
        <a href="https://github.com/WoWAnalyzer/WoWAnalyzer/wiki#getting-started">入门指南</a>
        ，或访问 <SmallDiscordButton /> 参与帮助！
      </AlertInfo>
    </div>
  );
};

const SmallDiscordButton = () => <DiscordButton style={{ padding: '1px 5px', height: 'unset ' }} />;

export default About;
