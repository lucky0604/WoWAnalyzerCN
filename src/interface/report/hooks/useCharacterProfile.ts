import { makeCharacterApiUrl } from 'common/makeApiUrl';
import fetchCnCharacterProfile from 'common/fetchCnArmory';
import CharacterProfile from 'parser/core/CharacterProfile';
import { PlayerDetails } from 'parser/core/Player';
import Report from 'parser/core/Report';
import { useEffect, useState } from 'react';
import { wclGameVersionToBranch } from 'game/VERSIONS';

const isCnRegion = (region?: string) => region?.toLowerCase() === 'cn';

const useCharacterProfile = ({ report, player }: { report: Report; player: PlayerDetails }) => {
  const [characterProfile, setCharacterProfile] = useState<CharacterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      // 玩家资料优先来自 exportedCharacters,回退到 player 自身(CN 报告两处都可能缺 realm)
      let region = player.region;
      let realm = player.server;
      let name = player.name;
      const exportedCharacter = report.exportedCharacters
        ? report.exportedCharacters.find((char) => char.name === player.name)
        : null;
      if (exportedCharacter) {
        region = exportedCharacter.region || region;
        realm = exportedCharacter.server || realm;
        name = exportedCharacter.name || name;
      }

      if (isCnRegion(region)) {
        // CN 没有上游 API,改走 CN armory 网关;失败静默降级
        const profile = await fetchCnCharacterProfile({ guid: player.guid, realm, name });
        setCharacterProfile(profile);
        setIsLoading(false);
        return;
      }

      const classic = wclGameVersionToBranch(report.gameVersion) === 'classic';

      try {
        const result = await fetch(makeCharacterApiUrl(player.guid, region, realm, name, classic));

        if (!result.ok) {
          console.warn(new Error('Character profile loading failed'));
        } else {
          setCharacterProfile(await result.json());
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [report, player]);

  return { characterProfile, isLoading };
};

export default useCharacterProfile;
