import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { validateDungeonDocument } from '../../src/dungeon/schema/validate';

import {
  addAuthoringEntity,
  authoringDiagnostics,
  loadAuthoringDocument,
  makeAuthoringScaffold,
  runAuthoringCommand,
} from './authoring';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('dungeon authoring scaffold', () => {
  it('creates a draft with stable IDs and actionable empty-content diagnostics', () => {
    const document = makeAuthoringScaffold('sample-dungeon');
    expect(document.dataStatus).toBe('draft');
    expect(document.floors[0]?.id).toBe('sample-dungeon-floor-1');
    expect(authoringDiagnostics(document).map((item) => item.code)).toEqual([
      'DUNGEON_AUTHORING_EMPTY_ENEMIES',
      'DUNGEON_AUTHORING_EMPTY_ABILITIES',
      'DUNGEON_AUTHORING_EMPTY_SITUATIONS',
      'DUNGEON_AUTHORING_EMPTY_ROUTES',
      'DUNGEON_AUTHORING_EMPTY_BOSSES',
      'DUNGEON_AUTHORING_PROVENANCE_UNREVIEWED',
      'DUNGEON_AUTHORING_TODO_REMAINING',
    ]);
  });

  it('adds entities without mutating the source document or registering runtime data', () => {
    const source = makeAuthoringScaffold('sample-dungeon');
    const withEnemy = addAuthoringEntity(source, 'enemy', { name: 'TODO enemy' });
    const withAbility = addAuthoringEntity(withEnemy, 'ability', {
      name: 'TODO cast',
      casterEnemyIds: ['sample-dungeon-enemy-1'],
    });
    const withSituation = addAuthoringEntity(withAbility, 'situation', {
      focusAbilityIds: ['sample-dungeon-ability-1'],
    });
    const withBoss = addAuthoringEntity(withSituation, 'boss', {
      enemyId: 'sample-dungeon-enemy-1',
      focusAbilityIds: ['sample-dungeon-ability-1'],
    });
    const final = addAuthoringEntity(withBoss, 'route-step', {
      situationIds: ['sample-dungeon-situation-1'],
    });

    expect(source.enemies).toHaveLength(0);
    expect(final.enemies[0]?.id).toBe('sample-dungeon-enemy-1');
    expect(final.abilities[0]?.casterEnemyIds).toEqual(['sample-dungeon-enemy-1']);
    expect(final.bosses[0]?.enemyId).toBe('sample-dungeon-enemy-1');
    expect(final.routes[0]?.steps[0]).toMatchObject({
      type: 'event',
      situationRefs: [{ situationId: 'sample-dungeon-situation-1', coverage: 'full' }],
    });
  });

  it('runs the documented CLI flow against an isolated authoring root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wowa-dungeon-authoring-'));
    temporaryRoots.push(root);
    await runAuthoringCommand([
      'new',
      'dungeon',
      '--season',
      'midnight-s2',
      '--slug',
      'sample',
      '--root',
      root,
    ]);
    await runAuthoringCommand(['add', 'enemy', '--dungeon', 'sample', '--root', root]);
    await runAuthoringCommand(['add', 'ability', '--dungeon', 'sample', '--root', root]);
    await runAuthoringCommand(['add', 'situation', '--dungeon', 'sample', '--root', root]);
    await runAuthoringCommand(['add', 'boss', '--dungeon', 'sample', '--root', root]);
    await runAuthoringCommand(['add', 'route-step', '--dungeon', 'sample', '--root', root]);

    const document = await loadAuthoringDocument('sample', root);
    expect(document.enemies).toHaveLength(1);
    expect(document.routes[0]?.steps).toHaveLength(1);
    expect(validateDungeonDocument(document).errors).toEqual([]);
    expect(await readFile(join(root, 'sample', 'AUTHORING.md'), 'utf8')).toContain(
      'second-person review',
    );
  });
});
