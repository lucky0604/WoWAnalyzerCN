import { describe, expect, it } from 'vitest';
import {
  spellUrl,
  itemUrl,
  npcUrl,
  itemSetUrl,
  resourceUrl,
  setWowDbBaseUrl,
} from '../wowDbProvider';

describe('wowDbProvider', () => {
  describe('spellUrl', () => {
    it('returns URL for a spell ID', () => {
      expect(spellUrl(123)).toBe('https://db.damijing.com/spell/123');
    });
  });

  describe('itemUrl', () => {
    it('returns URL for an item ID', () => {
      expect(itemUrl(456)).toBe('https://db.damijing.com/item/456');
    });
  });

  describe('npcUrl', () => {
    it('returns URL for an NPC ID', () => {
      expect(npcUrl(789)).toBe('https://db.damijing.com/npc/789');
    });
  });

  describe('itemSetUrl', () => {
    it('returns URL for an item set ID', () => {
      expect(itemSetUrl(42)).toBe('https://db.damijing.com/itemset/42');
    });
  });

  describe('resourceUrl', () => {
    it('returns null', () => {
      expect(resourceUrl(999)).toBeNull();
    });
  });

  describe('setWowDbBaseUrl', () => {
    it('strips trailing slash from base URL', () => {
      setWowDbBaseUrl('https://example.com/');
      expect(spellUrl(1)).toBe('https://example.com/spell/1');
      // Reset back to default
      setWowDbBaseUrl('https://db.damijing.com');
    });
  });
});
