import { AlertInfo, SpellLink } from 'interface';
import TALENTS from 'common/TALENTS/evoker';
import { t } from '@lingui/core/macro';

const BuffTargetHelperInfoLabel: React.FC = () => {
  return (
    <div className="container">
      <AlertInfo style={{ marginBottom: 30 }}>
        <p>
          <b>
            {t({id:'evoker.augmentation.buffTargetHelper.t31Note.p1',message:'Because you have T31 4pc, the note generated assumes the first '})}
            <SpellLink spell={TALENTS.PRESCIENCE_TALENT} />
            {t({id:'evoker.augmentation.buffTargetHelper.t31Note.p2',message:' you cast on pull is a long one.'})}
          </b>
        </p>
      </AlertInfo>
    </div>
  );
};

export default BuffTargetHelperInfoLabel;
