import { describe, it, expect } from 'vitest';
import {
  generateAkkharId,
  isAkkharId,
  formatAkkharIdTag,
  AKKHAR_ID_REGEX,
  AKKHAR_ID_TAG_REGEX,
} from '../../../src/utils/akkhar-id.js';

describe('akkhar-id', () => {
  describe('generateAkkharId', () => {
    it('produces strings matching the AKID format', () => {
      for (let i = 0; i < 50; i++) {
        const id = generateAkkharId();
        expect(id).toMatch(AKKHAR_ID_REGEX);
        expect(isAkkharId(id)).toBe(true);
      }
    });

    it('embeds a roughly current timestamp', () => {
      const before = Date.now();
      const id = generateAkkharId();
      const after = Date.now();
      const ts = Number(id.split('_')[1]);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('has a 6-hex-character random suffix', () => {
      const id = generateAkkharId();
      const suffix = id.split('_')[2];
      expect(suffix).toMatch(/^[a-f0-9]{6}$/);
    });

    it('produces unique ids across rapid calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) ids.add(generateAkkharId());
      expect(ids.size).toBe(1000);
    });
  });

  describe('isAkkharId', () => {
    it('rejects malformed values', () => {
      expect(isAkkharId('')).toBe(false);
      expect(isAkkharId('AKID')).toBe(false);
      expect(isAkkharId('AKID_123')).toBe(false);
      expect(isAkkharId('AKID_123_XYZ')).toBe(false); // not lowercase hex
      expect(isAkkharId('AKID_123_abc')).toBe(false); // wrong length
      expect(isAkkharId('akid_123_abcdef')).toBe(false); // wrong prefix case
      expect(isAkkharId('AKID_123_abcdefg')).toBe(false); // 7 chars
    });

    it('accepts valid synthetic ids', () => {
      expect(isAkkharId('AKID_1_000000')).toBe(true);
      expect(isAkkharId('AKID_1715234567890_f7a3b2')).toBe(true);
    });
  });

  describe('formatAkkharIdTag / AKKHAR_ID_TAG_REGEX', () => {
    it('wraps the AKID in <AKKHAR_ID_...> brackets', () => {
      const id = 'AKID_1715234567890_f7a3b2';
      expect(formatAkkharIdTag(id)).toBe(`<AKKHAR_ID_${id}>`);
    });

    it('round-trips through the tag regex', () => {
      const id = generateAkkharId();
      const tag = formatAkkharIdTag(id);
      const m = tag.match(AKKHAR_ID_TAG_REGEX);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(id);
    });

    it('extracts the AKID from a larger string containing the tag', () => {
      const id = generateAkkharId();
      const haystack = `Some prompt content\n\n${formatAkkharIdTag(id)}`;
      const m = haystack.match(AKKHAR_ID_TAG_REGEX);
      expect(m?.[1]).toBe(id);
    });
  });
});
