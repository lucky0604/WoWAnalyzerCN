import { AlertInfo, SpellLink } from 'interface';
import TALENTS from 'common/TALENTS/evoker';
import { Trans } from '@lingui/react/macro';

const BuffTargetHelperInfoLabel: React.FC = () => {
  return (
    <div className="container">
      <AlertInfo style={{ marginBottom: 30 }}>
        <p>
          <b>
            <Trans id="evoker.augmentation.buffTargetHelper.t31Note">
              Because you have T31 4pc, the note generated assumes the first{' '}
              <SpellLink spell={TALENTS.PRESCIENCE_TALENT} /> you cast on pull is a long one.
            </Trans>
          </b>
        </p>
      </AlertInfo>
    </div>
  );
};

export default BuffTargetHelperInfoLabel;
