import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import AlertWarning from 'interface/AlertWarning';

const OldExpansionWarning = () => (
  <div className="container">
    <AlertWarning style={{ marginBottom: 30 }}>
      <h2>
        {t({
          id: 'interface.report.oldLogWarning.title',
          message: 'Unsupported encounters detected',
        })}
      </h2>
      <Trans id="interface.report.oldLogWarning.details">
        The current report contains encounters from an old World of Warcraft expansion. Old
        expansion logs are not supported.
      </Trans>
    </AlertWarning>
  </div>
);

export default OldExpansionWarning;
