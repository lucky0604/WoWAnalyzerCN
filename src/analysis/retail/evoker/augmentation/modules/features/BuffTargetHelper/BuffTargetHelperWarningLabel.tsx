import AlertWarning from 'interface/AlertWarning';
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro';

const BuffTargetHelperWarningLabel = () => {
  return (
    <div className="container">
      <AlertWarning style={{ marginBottom: 30 }}>
        <b>
          <Trans id="evoker.augmentation.buffTargetHelper.notAccurate">
            Results might not be fully accurate
          </Trans>
        </b>
        <p>
          <Trans id="evoker.augmentation.buffTargetHelper.notAccurateDesc">
            Even though there have been improvements in combatlog hooks for re-attribution, there are
            still some cases that may result in inaccuracies. So, it's better to think of this list as
            a suggestion rather than something absolutely accurate.
          </Trans>
        </p>
        <b>
          <>{t({ id: 'evoker.augmentation.buffTargetHelper.moreInfo.p1', message: 'You can head over' })}
            {' '}
            <a href="https://gist.github.com/ljosberinn/a2f08a53cfe8632a18350eea44e9da3e">{t({ id: 'evoker.augmentation.buffTargetHelper.moreInfo.a', message: 'here' })}</a>
            {' '}
            {t({ id: 'evoker.augmentation.buffTargetHelper.moreInfo.p2', message: 'for more information about above mentioned issues.' })}
          </>
        </b>
      </AlertWarning>
    </div>
  );
};

export default BuffTargetHelperWarningLabel;
