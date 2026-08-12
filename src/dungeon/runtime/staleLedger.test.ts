import { describe, expect, it } from 'vitest';

import { phase0FixtureDocuments } from '../registry';
import {
  documentKnowledgeIds,
  validateStaleLedger,
  type StaleKnowledgeLedger,
} from './staleLedger';

describe('stale knowledge ledger', () => {
  it('accepts the committed empty ledger and knows document IDs', () => {
    const document = phase0FixtureDocuments.rubyLifePools;
    const ids = documentKnowledgeIds(document);
    expect(ids.size).toBeGreaterThan(0);
    expect(validateStaleLedger({ version: 1, entries: [] }, ids)).toEqual({ ok: true, errors: [] });
  });

  it('rejects duplicate, unknown and impossible entries', () => {
    const ledger: StaleKnowledgeLedger = {
      version: 1,
      entries: [
        {
          knowledgeId: 'missing-knowledge',
          reason: 'changed',
          markedAt: '2026-02-31T00:00:00.000Z',
        },
        {
          knowledgeId: 'missing-knowledge',
          reason: '',
          markedAt: 'not-a-date',
        },
      ],
    };
    const result = validateStaleLedger(ledger, new Set(['known-knowledge']));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'DUNGEON_STALE_LEDGER_UNKNOWN_KNOWLEDGE missing-knowledge',
        'DUNGEON_STALE_LEDGER_INVALID_MARKED_AT missing-knowledge',
        'DUNGEON_STALE_LEDGER_INVALID_KNOWLEDGE_ID #1',
        'DUNGEON_STALE_LEDGER_INVALID_REASON missing-knowledge',
      ]),
    );
  });

  it('accepts the shared UTC form without milliseconds', () => {
    expect(
      validateStaleLedger({
        version: 1,
        entries: [{ knowledgeId: 'known', reason: 'changed', markedAt: '2026-08-12T00:00:00Z' }],
      }),
    ).toEqual({ ok: true, errors: [] });
  });
});
