/**
 * 战斗观测台 · 演示数据
 * 全部为视觉稿虚构数据（塞塔利斯神庙 M+12 · 奥法），不依赖真实 WCL 报告。
 * 技能图标走 assets.rpglogs.com CDN（interface/Icon 的 iconUrl）。
 */

export type RouteNodeStatus = 'good' | 'info' | 'warning' | 'problem';
export type RouteNodeKind = 'start' | 'pull' | 'boss' | 'end';

export interface RouteNode {
  id: string;
  /** 时间轴标签，如 02:38 */
  time: string;
  name?: string;
  kind: RouteNodeKind;
  status?: RouteNodeStatus;
  /** 关联优先改进项 id —— Focus Mode 的脉冲目标 */
  issueId?: string;
  /** 展示的技能图标（iconUrl 名） */
  icon?: string;
  /** viewBox 800×300 内的坐标 */
  x: number;
  y: number;
}

export const ROUTE_VIEWBOX = { width: 800, height: 300 } as const;

export const routeNodes: RouteNode[] = [
  { id: 'n0', time: '00:00', name: '开场', kind: 'start', x: 36, y: 208 },
  {
    id: 'n1',
    time: '02:38',
    name: '爆发窗口缺失',
    kind: 'pull',
    status: 'problem',
    issueId: 'p1',
    icon: 'ability_mage_arcanesurge',
    x: 128,
    y: 128,
  },
  { id: 'n2', time: '05:40', kind: 'pull', x: 218, y: 226 },
  {
    id: 'n3',
    time: '07:14',
    name: '唤醒延迟',
    kind: 'pull',
    status: 'warning',
    issueId: 'p2',
    icon: 'spell_nature_purge',
    x: 292,
    y: 96,
  },
  { id: 'n4', time: '10:05', name: '完美执行', kind: 'pull', status: 'good', x: 372, y: 176 },
  { id: 'n5', time: '12:30', name: 'BOSS', kind: 'boss', x: 438, y: 64 },
  { id: 'n6', time: '15:26', kind: 'pull', x: 502, y: 216 },
  { id: 'n7', time: '18:12', name: 'BOSS', kind: 'boss', x: 566, y: 118 },
  {
    id: 'n8',
    time: '23:41',
    name: '宝石未回收',
    kind: 'pull',
    status: 'warning',
    issueId: 'p3',
    icon: 'inv_misc_gem_sapphire_02',
    x: 642,
    y: 200,
  },
  { id: 'n9', time: '27:05', name: 'BOSS', kind: 'boss', x: 706, y: 96 },
  { id: 'n10', time: '31:42', name: '限时完成', kind: 'end', status: 'good', x: 774, y: 60 },
];

export interface Instrument {
  label: string;
  value: string;
  unit?: string;
  tone?: 'default' | 'gold' | 'good';
  sub?: string;
  /** 微型趋势线（0–1 归一化） */
  spark?: number[];
}

export const instruments: Instrument[] = [
  { label: '总伤害', value: '87.3', unit: 'M', sub: 'DPS 46.1k' },
  { label: '有效治疗', value: '1.41', unit: 'M', sub: 'HPS 742' },
  { label: '存活率', value: '91.4', unit: '%', sub: '阵亡 0 次' },
  { label: '最佳分位', value: '98', tone: 'gold', sub: '奥法 · 国服前 2%' },
  { label: '解析用时', value: '30', unit: 's', sub: '3,182 万事件' },
  {
    label: '本周趋势',
    value: '+4.2',
    unit: '%',
    tone: 'good',
    sub: '对比上周',
    spark: [0.3, 0.42, 0.38, 0.55, 0.5, 0.68, 0.62, 0.8, 0.88],
  },
];

export interface Insight {
  id: string;
  no: string;
  title: string;
  value: string;
  tone: 'danger' | 'warning';
  target: string;
  desc: string;
  gain: string;
  at: string;
}

export const insights: Insight[] = [
  {
    id: 'p1',
    no: '01',
    title: '奥术强化覆盖率偏低',
    value: '38%',
    tone: 'danger',
    target: '目标 > 70%',
    desc: '关键爆发窗口共 4 次，其中 2 次未对齐 Pom 触发，损失约 6.2% 总伤害。',
    gain: '+6.2% DPS',
    at: '02:38',
  },
  {
    id: 'p2',
    no: '02',
    title: '唤醒施放偏晚',
    value: '21%',
    tone: 'warning',
    target: '延迟目标 < 10%',
    desc: '唤醒平均比最优窗口晚 21% 施放，法力触底 12%，存在断蓝风险。',
    gain: '+3.1% DPS',
    at: '07:14',
  },
  {
    id: 'p3',
    no: '03',
    title: '法力宝石 2/3 少回收',
    value: '2/3',
    tone: 'warning',
    target: '目标 3/3',
    desc: '第 3 颗法力宝石整场未使用，少回收约 212k 法力，尾盘被迫节制输出。',
    gain: '+1.4% DPS',
    at: '23:41',
  },
];

export type PriorityLevel = 1 | 2 | 3 | 4;

export interface Priority {
  id: string;
  level: PriorityLevel;
  title: string;
  value: string;
  valueTone: 'danger' | 'warning' | 'info' | 'good';
  target: string;
  impact: string;
  at: string;
}

export const priorities: Priority[] = [
  {
    id: 'p1',
    level: 1,
    title: '奥术强化覆盖率偏低',
    value: '38%',
    valueTone: 'danger',
    target: '目标 > 70%',
    impact: '关键爆发窗口 4 次中 2 次未对齐 Pom，损失约 6.2% 总伤害。',
    at: '02:38',
  },
  {
    id: 'p2',
    level: 2,
    title: '唤醒施放偏晚',
    value: '21%',
    valueTone: 'warning',
    target: '延迟目标 < 10%',
    impact: '唤醒平均比最优窗口晚 21% 施放，法力触底 12%，存在断蓝风险。',
    at: '07:14',
  },
  {
    id: 'p3',
    level: 3,
    title: '法力宝石使用不足',
    value: '2/3',
    valueTone: 'info',
    target: '目标 3/3',
    impact: '第 3 颗法力宝石整场未使用，少回收约 212k 法力。',
    at: '23:41',
  },
  {
    id: 'p4',
    level: 4,
    title: '移动战中奥术飞弹替代预读',
    value: '14',
    valueTone: 'good',
    target: '影响 14 次',
    impact: '移动中 14 次以奥术飞弹替代预读，DPS 损失约 2.1%，处理得当，保持即可。',
    at: '全程',
  },
];

export interface Snapshot {
  name: string;
  icon: string;
  value: string;
  /** 0–1，条形宽度 */
  ratio: number;
  tone: 'good' | 'info' | 'warning' | 'danger';
}

export const snapshots: Snapshot[] = [
  {
    name: '奥术强化 覆盖',
    icon: 'ability_mage_arcanesurge',
    value: '38%',
    ratio: 0.38,
    tone: 'warning',
  },
  { name: '唤醒 平均延迟', icon: 'spell_nature_purge', value: '21%', ratio: 0.21, tone: 'warning' },
  {
    name: '法力宝石 回收',
    icon: 'inv_misc_gem_sapphire_02',
    value: '2/3',
    ratio: 0.67,
    tone: 'info',
  },
  {
    name: '奥术飞弹 移动占比',
    icon: 'spell_nature_starfall',
    value: '14 次',
    ratio: 0.14,
    tone: 'good',
  },
];

export const teamNotes = [
  '02:38 爆发窗口前，预留 奥术强化 + Pom 双触发，再开嗜血类增益。',
  '07:14 唤醒提前约 1.5s 引导，可避开打断窗口并避免法力触底。',
];

export const guides = [
  { name: '奥法基础循环与爆发指南', meta: '指南 · 8 min' },
  { name: '塞塔利斯神庙 M+ 路线参考', meta: '路线 · 5 min' },
];

/** 法力曲线（分钟 → 剩余法力 %），唤醒点以金线标注 */
export const manaCurve: [number, number][] = [
  [0, 100],
  [1.2, 88],
  [2.1, 62],
  [2.67, 12],
  [3.6, 9],
  [4.6, 22],
  [5.8, 16],
  [7.23, 86],
  [8.6, 74],
  [10, 58],
  [11.5, 40],
  [13, 24],
  [14.4, 12],
  [15.43, 78],
  [16.8, 66],
  [18.2, 50],
  [19.6, 32],
  [21, 18],
  [22.4, 10],
  [23.68, 62],
  [25, 52],
  [26.4, 38],
  [27.8, 24],
  [29.2, 15],
  [30.6, 10],
  [31.42, 8],
];

export const evocationTicks = [7.23, 15.43, 23.68];
export const manaTrough = { at: 2.67, value: 12 };

export const workbenchStats = [
  { label: '平均法力水位', value: '45.3%' },
  { label: '结束时剩余法力', value: '8%' },
  { label: '引导期输出损失', value: '7.6%' },
];

export interface Dossier {
  id: string;
  kind: string;
  name: string;
  meta: string;
  score: number;
  date: string;
}

export const dossiers: Dossier[] = [
  { id: 'd1', kind: 'M+ 12', name: '塞塔利斯神庙', meta: '限时 31:42', score: 98, date: '09-02' },
  { id: 'd2', kind: 'M+ 10', name: '破碎尖塔', meta: '限时 28:05', score: 92, date: '09-01' },
  { id: 'd3', kind: '团本', name: '熔铸圣所 · H4', meta: '击杀 04:12', score: 89, date: '08-31' },
  { id: 'd4', kind: 'M+ 7', name: '燧酿地壕', meta: '限时 24:50', score: 87, date: '08-30' },
  { id: 'd5', kind: 'M+ 4', name: '幻光回廊', meta: '超时 02:14', score: 76, date: '08-29' },
];
