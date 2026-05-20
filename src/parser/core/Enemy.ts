import { i18n } from '@lingui/core';
import { getMobCnName } from 'common/CN_MAPPING';
import CombatLogParser from './CombatLogParser';
import Entity from './Entity';
import Unit from './Unit';

interface EnemyFight {
  id: number;
  groups: number;
  instances: number;
}

export interface EnemyInfo extends Unit {
  fights: EnemyFight[];
}

class Enemy extends Entity {
  private readonly baseInfo: EnemyInfo;
  readonly instanceID: number;

  override get name() {
    const englishName = this.baseInfo.name;
    if (i18n.locale === 'zh') {
      return getMobCnName(englishName) ?? englishName;
    }
    return englishName;
  }

  /** Generally "NPC" */
  get type() {
    return this.baseInfo.type;
  }

  /** Generally "Boss" or "NPC" */
  get subType() {
    return this.baseInfo.subType;
  }

  get guid() {
    return this.baseInfo.guid;
  }

  get id() {
    return this.baseInfo.id;
  }

  get fights() {
    return this.baseInfo.fights;
  }

  constructor(owner: CombatLogParser, baseInfo: EnemyInfo, instanceID = 0) {
    super(owner);
    this.baseInfo = baseInfo;
    this.instanceID = instanceID;
  }
}

export default Enemy;
