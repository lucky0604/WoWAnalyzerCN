import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro';
import VERSIONS from 'game/VERSIONS';
import Config from 'parser/Config';
import { WCLFight } from 'parser/core/Fight';
import { PlayerDetails } from 'parser/core/Player';
import Report from 'parser/core/Report';
import { useLingui } from '@lingui/react';

import SupportCheckerIssue from './SupportCheckerIssue';

interface Props {
  report: Report;
  fight: WCLFight;
  config: Config;
  player: PlayerDetails;
  onContinueAnyway: () => void;
}

const SupportCheckerSpecOutOfDate = ({ config, ...others }: Props) => {
  const { i18n } = useLingui();

  const gameVersion = VERSIONS[config.branch];
  const specName = config.spec.specName ? i18n._(config.spec.specName) : null;
  const className = i18n._(config.spec.className);
  console.log('SupportCheckerSpecOutOfDate', { specName, className });

  return (
    <SupportCheckerIssue
      title={
        <Trans id="interface.report.supportChecker.outdated">
          This spec has not been updated for patch {gameVersion}
        </Trans>
      }
      config={config}
      testId="spec-not-updated-for-patch"
      {...others}
    >
      <>{t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p1', message: 'Sorry, this spec hasn\'t been updated for the latest patch so we\'re afraid it might be outdated and potentially mislead. We recommend reading the Wowhead' })}
        {' '}
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p2', message: 'and ' })}
        <a href="https://www.icy-veins.com/wow/class-guides">{t({ id: 'interface.report.supportChecker.specNotSupportedDetails.a', message: 'Icy Veins' })}</a>
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p3', message: 'guides to gain more knowledge about your spec and use this to analyze yourself. You can also try asking for help in a ' })}
        <a href="https://www.reddit.com/r/wow/wiki/discord">{t({ id: 'interface.report.supportChecker.specNotSupportedDetails.a2', message: 'class Discord' })}</a>
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p4', message: '. ' })}
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p5', message: 'We have no ETA for an update to ' })}
        {specName}
        {i18n._(config.spec.className)}
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p6', message: '. We rely on volunteer contributors to maintain spec analysis, and seeing as ' })}
        {specName}
        {' '}
        {i18n._(config.spec.className)}
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p7', message: 'is out of date, it may be that nobody is currently maintaining it. If you are interested or know someone who might be interested helping people help themselves, check out ' })}
        <a href="https://github.com/WoWAnalyzer/WoWAnalyzer">{t({ id: 'interface.report.supportChecker.specNotSupportedDetails.a3', message: 'GitHub' })}</a>
        {' '}
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p8', message: 'or ' })}
        <a href="https://wowanalyzer.com/discord">{t({ id: 'interface.report.supportChecker.specNotSupportedDetails.a4', message: 'Discord' })}</a>
        {t({ id: 'interface.report.supportChecker.specNotSupportedDetails.p9', message: 'for more information.' })}
      </>
    </SupportCheckerIssue>
  );
};

export default SupportCheckerSpecOutOfDate;
