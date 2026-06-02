import { t } from '@lingui/core/macro';
import { Race } from 'game/RACES';

const CharacterRace = ({ race }: { race: Race }) => (
  <>
    <div className="row">
      <div className="col-md-12">
        <h2>{t({ id: 'common.race', message: 'Race' })}</h2>
      </div>
    </div>
    <div className="row">
      <div className="col-md-12 hpadding-lg-30">
        {/* some bonus padding so it looks to be aligned with the icon for stats */}
        {race ? race.name : 'Unknown'}
      </div>
    </div>
  </>
);

export default CharacterRace;
