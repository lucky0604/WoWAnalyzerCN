import type { Raid } from 'game/raids';
import { buildBoss } from 'game/raids/builders';
import WindrunnerSpire from './backgrounds/WindrunnerSpire.jpg';
import Skyreach from './backgrounds/Skyreach.jpg';
import SeatOfTheTriumvirate from './backgrounds/SeatOfTheTriumvirate.jpg';
import PitOfSaron from './backgrounds/PitOfSaron.jpg';
import NexusPointXenas from './backgrounds/NexusPointXenas.jpg';
import MaisaraCaverns from './backgrounds/MaisaraCaverns.jpg';
import MagistersTerrace from './backgrounds/MagistersTerrace.jpg';
import AlgetharAcademy from './backgrounds/AlgetharAcademy.jpg';

export default {
  name: 'Mythic+ Season 1',
  background: NexusPointXenas,
  bosses: {
    MagistersTerrace: buildBoss({
      id: 12811,
      name: '魔导师平台',
      background: MagistersTerrace,
    }),
    MaisaraCaverns: buildBoss({
      id: 12874,
      name: '迈萨拉洞窟',
      background: MaisaraCaverns,
    }),
    NexusPointXenas: buildBoss({
      id: 12915,
      name: '节点希纳斯',
      background: NexusPointXenas,
    }),
    WindrunnerSpire: buildBoss({
      id: 12805,
      name: '风行者之塔',
      background: WindrunnerSpire,
    }),
    AlgetharAcademy: buildBoss({
      id: 112526,
      name: '艾杰斯亚学院',
      background: AlgetharAcademy,
    }),
    SeatOfTheTriumvirate: buildBoss({
      id: 361753,
      name: '执政团之座',
      background: SeatOfTheTriumvirate,
    }),
    Skyreach: buildBoss({
      id: 61209,
      name: '通天峰',
      background: Skyreach,
    }),
    PitOfSaron: buildBoss({
      id: 10658,
      name: '萨隆矿坑',
      background: PitOfSaron,
    }),
  },
} satisfies Raid;
