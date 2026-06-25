// Minimal headless CombatLogParser for MCP runtime.
// Mirrors src/parser/core/CombatLogParser.tsx public surface:
//   - constructor(config, report, player, fight, combatantInfo, characterProfile, playerDetails)
//   - initializeModules / loadModule / DI loop
//   - getModule / getOptionalModule (with inheritance chain match)
//   - addEventListener (delegates to EventEmitter)
//   - normalize(events) (iterates EventsNormalizer instances)
//   - finish()
//   - deepDisable(module, state, error?)
//
// What's stripped: JSX rendering (statistic/guideSubsection), generateResults,
// server metrics, time filtering, Sentry reporting, eventLinks aggregation.
// Spec subclasses (e.g. MistweaverCombatLogParser) work via static specModules.

import Module, { type Options } from 'parser/core/Module';
import ModuleError from 'parser/core/ModuleError';
import EventEmitter from 'parser/core/modules/EventEmitter';
import EventsNormalizer from 'parser/core/EventsNormalizer';
import type EventFilter from 'parser/core/EventFilter';
import type { AnyEvent, EventType, CombatantInfoEvent } from 'parser/core/Events';
import { HasSource, HasTarget } from 'parser/core/Events';
import type { EventListener } from 'parser/core/EventSubscriber';
import type { FullCombatant } from 'parser/core/Combatant';
import type { PlayerInfo } from 'parser/core/Player';
import type { PetInfo } from 'parser/core/Pet';
import type { Info } from 'parser/core/metric';

interface Spec {
  id: number;
  primaryStat?: string;
  branch?: string;
  wclClassName?: string;
  wclSpecName?: string;
}

interface MinimalConfig {
  branch: string;
  spec: Spec;
  statMultipliers?: Record<string, number>;
  patchCompatibility?: string | null;
}

interface MinimalReport {
  title?: string;
  start: number;
  end: number;
  friendlies: PlayerInfo[];
  friendlyPets: PetInfo[];
  enemies: unknown[];
  enemyPets: unknown[];
  gameVersion?: number;
}

interface MinimalFight {
  id: number;
  start_time: number;
  end_time: number;
  boss: number;
  name: string;
  offset_time?: number;
  kill?: boolean;
  difficulty?: number;
}

interface MinimalPlayerDetails {
  id: number;
  name: string;
  type?: string;
  specName?: string;
  className?: string;
}

interface MinimalCharacterProfile {
  race: number | null;
}

interface ModuleErrorDetails {
  key: string;
  module: typeof Module;
  error?: unknown;
}

type DependencyDefinition = typeof Module | readonly [typeof Module, Record<string, unknown>];
type DependenciesDefinition = Record<string, DependencyDefinition>;

const MAX_DI_ITERATIONS = 100;

class CombatLogParser {
  // Internal modules: minimum viable set. Subclasses override defaultModules/specModules.
  static internalModules: DependenciesDefinition = {
    eventEmitter: EventEmitter,
  };
  static defaultModules: DependenciesDefinition = {};
  static specModules: DependenciesDefinition = {};

  config: MinimalConfig;
  report: MinimalReport;
  characterProfile: MinimalCharacterProfile;
  player: PlayerInfo;
  readonly playerCombatantInfo: CombatantInfoEvent | undefined;
  playerPets: PetInfo[];
  fight: MinimalFight;
  boss: { id: number } | null = null;
  readonly playerDetails: MinimalPlayerDetails[];

  disabledModules!: Record<ModuleError, ModuleErrorDetails[]>;

  adjustForDowntime = false;
  finished = false;

  _modules: Record<string, Module> = {};
  _moduleCache = new Map<unknown, Module | undefined>();

  _timestamp: number;
  get currentTimestamp(): number {
    return this.finished ? this.fight.end_time : this._timestamp;
  }
  get fightDuration(): number {
    return this.currentTimestamp - this.fight.start_time;
  }
  get playerId(): number {
    return this.player.id;
  }
  get fightId(): number {
    return this.fight.id;
  }
  get activeModules(): Module[] {
    return Object.values(this._modules).filter((module) => module.active);
  }
  get players(): PlayerInfo[] {
    return this.report.friendlies;
  }
  // selectedCombatant intentionally returns a minimal placeholder for modules that
  // touch `selectedCombatant.player.icon` etc. during error-path Sentry logging.
  // Real Combatants module (when wired) overrides via getModule(Combatants).selected.
  get selectedCombatant(): FullCombatant {
    return {
      id: this.player.id,
      name: this.player.name,
      player: { id: this.player.id, name: this.player.name, icon: '' },
    } as unknown as FullCombatant;
  }

  applyTimeFilter: (start: number, end: number) => null = () => null;
  normalizedEvents: AnyEvent[] = [];

  // Info getter satisfies Analyzer.statistic() signature for typecheck.
  // Headless runtime never calls statistic(); analyzers are read via getModule().
  get info(): Info {
    return {
      playerId: this.player.id,
      pets: [],
      abilities: [],
      defaultRange: 0,
      originalFightStart: this.fight.start_time - (this.fight.offset_time ?? 0),
      fightStart: this.fight.start_time,
      fightEnd: this.fight.end_time,
      fightDuration: this.fight.end_time - this.fight.start_time,
      fightId: this.fight.id,
      reportCode: '',
      combatant: this.selectedCombatant,
    };
  }
  eventCount = 0;
  eventHistory: AnyEvent[] = [];

  constructor(
    config: MinimalConfig,
    report: MinimalReport,
    selectedPlayer: MinimalPlayerDetails,
    selectedFight: MinimalFight,
    playerCombatantInfo: CombatantInfoEvent | undefined,
    characterProfile: MinimalCharacterProfile,
    playerDetails: MinimalPlayerDetails[],
  ) {
    this.config = config;
    this.report = report;
    this.playerCombatantInfo = playerCombatantInfo;
    this.playerDetails = playerDetails;

    const playerInfo = report.friendlies.find((p) => p.id === selectedPlayer.id);
    if (!playerInfo) {
      throw new Error(`could not locate character with id ${selectedPlayer.id}`);
    }
    this.player = playerInfo;
    this.playerPets = report.friendlyPets.filter(
      (pet) => (pet as { petOwner?: number }).petOwner === selectedPlayer.id,
    );
    this.fight = selectedFight;
    this.characterProfile = characterProfile;
    this._timestamp = selectedFight.start_time;
    this.disabledModules = Object.fromEntries(
      Object.values(ModuleError).map((key) => [key, [] as ModuleErrorDetails[]]),
    ) as Record<ModuleError, ModuleErrorDetails[]>;

    const ctor = this.constructor as typeof CombatLogParser;
    this.initializeModules({
      ...ctor.internalModules,
      ...ctor.defaultModules,
      ...ctor.specModules,
    });
  }

  finish(): void {
    this.finished = true;
    const emitter = this.getModule(EventEmitter);
    console.log(
      '[mcp-server] Events triggered:',
      emitter.numTriggeredEvents,
      'listeners:',
      emitter.numEventListeners,
      'called:',
      emitter.numListenersCalled,
    );
  }

  _getModuleClass(config: DependencyDefinition): [typeof Module, Record<string, unknown>] {
    if (Array.isArray(config)) {
      return [config[0], config[1]];
    }
    return [config as typeof Module, {}];
  }

  _resolveDependencies(
    dependencies: Record<string, typeof Module> | undefined,
  ): readonly [Record<string, Module>, (typeof Module)[]] {
    const available: Record<string, Module> = {};
    const missing: (typeof Module)[] = [];
    if (dependencies) {
      for (const [name, depClass] of Object.entries(dependencies)) {
        const inst = this.getOptionalModule(
          depClass as unknown as new (options: Options) => Module,
        );
        if (inst) {
          available[name] = inst;
        } else {
          missing.push(depClass);
        }
      }
    }
    return [available, missing] as const;
  }

  loadModule<T extends typeof Module>(
    moduleClass: T,
    options: { [prop: string]: unknown; priority: number },
    desiredModuleName = `module${Object.keys(this._modules).length}`,
  ): Module {
    const fullOptions = { ...options, owner: this as unknown };
    // eslint-disable-next-line new-cap
    const instance = new (moduleClass as unknown as new (o: Options) => Module)(
      fullOptions as Options,
    );
    Module.applyDependencies(fullOptions as Options, instance);
    instance.key = desiredModuleName;
    this._modules[desiredModuleName] = instance;
    return instance;
  }

  initializeModules(modules: DependenciesDefinition, iteration = 1): void {
    const failed: string[] = [];
    for (const desiredName of Object.keys(modules)) {
      const moduleConfig = modules[desiredName];
      if (!moduleConfig) {
        continue;
      }
      const [moduleClass, options] = this._getModuleClass(moduleConfig);
      const [available, missing] = this._resolveDependencies(moduleClass.dependencies);

      if (missing.length === 0) {
        const priority = Object.keys(this._modules).length;
        try {
          this.loadModule(moduleClass, { ...options, ...available, priority }, desiredName);
        } catch (e) {
          this.disabledModules[ModuleError.INITIALIZATION].push({
            key: moduleClass.name || desiredName,
            module: moduleClass,
            error: e,
          });
          console.warn(`[mcp-server] ${moduleClass.name} disabled (init error):`, e);
        }
      } else {
        const previouslyDisabled = missing
          .map((d) => d.name)
          .filter((name) =>
            this.disabledModules[ModuleError.INITIALIZATION].some((d) => d.module.name === name),
          );
        if (previouslyDisabled.length > 0) {
          this.disabledModules[ModuleError.DEPENDENCY].push({
            key: moduleClass.name || desiredName,
            module: moduleClass,
          });
        } else {
          failed.push(desiredName);
        }
      }
    }

    if (failed.length > 0) {
      if (iteration > MAX_DI_ITERATIONS) {
        throw new Error(
          `Failed to load modules after ${MAX_DI_ITERATIONS} iterations: ${failed.join(', ')}`,
        );
      }
      const retryBatch: DependenciesDefinition = {};
      for (const key of failed) {
        retryBatch[key] = modules[key];
      }
      this.initializeModules(retryBatch, iteration + 1);
    } else {
      this.allModulesInitialized();
    }
  }

  allModulesInitialized(): void {
    /* override hook */
  }

  getOptionalModule<T extends Module>(type: new (options: Options) => T): T | undefined {
    const cached = this._moduleCache.get(type);
    if (cached !== undefined) {
      return cached as T;
    }
    const found = Object.values(this._modules).find((m) => m instanceof type);
    this._moduleCache.set(type, found);
    return found as T | undefined;
  }

  getModule<T extends Module>(type: new (options: Options) => T): T {
    const module = this.getOptionalModule(type);
    if (!module) {
      throw new Error(`Module not found: ${type.name}`);
    }
    return module;
  }

  normalize(events: AnyEvent[]): AnyEvent[] {
    let out = events;
    this.activeModules
      .filter((m): m is EventsNormalizer => m instanceof EventsNormalizer)
      .sort((a, b) => a.priority - b.priority)
      .forEach((n) => {
        if (n.normalize) {
          out = n.normalize(out);
        }
      });
    return out;
  }

  addEventListener<ET extends EventType, E extends AnyEvent<ET>>(
    eventFilter: ET | EventFilter<ET>,
    listener: EventListener<ET, E>,
    module: Module,
  ): void {
    this.getModule(EventEmitter).addEventListener(eventFilter, listener, module);
  }

  deepDisable(module: Module, state: ModuleError, error?: Error): void {
    if (!module.active) {
      return;
    }
    console.warn('[mcp-server] Disabling', module.key || module.constructor.name);
    this.disabledModules[state].push({
      key: module.key || module.constructor.name,
      module: module.constructor as typeof Module,
      ...(error && { error }),
    });
    module.active = false;
    // Cascade: disable any active module that depends on the just-disabled one.
    for (const active of this.activeModules) {
      const ctor = active.constructor as typeof Module;
      const deps = ctor.dependencies;
      if (
        deps &&
        Object.values(deps).some((d) => active instanceof Module && module instanceof d)
      ) {
        this.deepDisable(active, ModuleError.DEPENDENCY);
      }
    }
  }

  byPlayer(event: AnyEvent): boolean {
    return HasSource(event) && event.sourceID === this.player.id;
  }
  byPlayerPet(event: AnyEvent): boolean {
    return HasSource(event) && this.playerPets.some((pet) => pet.id === event.sourceID);
  }
  toPlayer(event: AnyEvent): boolean {
    return HasTarget(event) && event.targetID === this.player.id;
  }
  toPlayerPet(event: AnyEvent): boolean {
    return HasTarget(event) && this.playerPets.some((pet) => pet.id === event.targetID);
  }
}

export default CombatLogParser;
export type {
  MinimalConfig,
  MinimalReport,
  MinimalFight,
  MinimalPlayerDetails,
  MinimalCharacterProfile,
};
