import { describe, it, expect } from 'bun:test';
import { t, validateSchema, type Static } from '../schema';

const opts = { whitelist: false, forbidden: false };

describe('validateSchema', () => {
  describe('primitives', () => {
    it('accepts matching primitives', () => {
      expect(validateSchema(t.string(), 'hi', opts)).toBe(true);
      expect(validateSchema(t.number(), 42, opts)).toBe(true);
      expect(validateSchema(t.boolean(), false, opts)).toBe(true);
    });

    it('rejects wrong primitive types', () => {
      expect(validateSchema(t.string(), 42, opts)).toBe(false);
      expect(validateSchema(t.number(), '42', opts)).toBe(false);
      expect(validateSchema(t.boolean(), 'true', opts)).toBe(false);
    });
  });

  describe('object', () => {
    const schema = t.object({ name: t.string(), age: t.number() });

    it('accepts an object whose fields all match', () => {
      expect(validateSchema(schema, { name: 'Alex', age: 21 }, opts)).toBe(true);
    });

    it('rejects a non-object', () => {
      expect(validateSchema(schema, 'nope', opts)).toBe(false);
      expect(validateSchema(schema, null, opts)).toBe(false);
    });

    it('rejects a missing required field', () => {
      expect(validateSchema(schema, { name: 'Alex' }, opts)).toBe(false);
    });

    it('rejects a field of the wrong type', () => {
      expect(validateSchema(schema, { name: 'Alex', age: '21' }, opts)).toBe(
        false,
      );
    });
  });

  describe('optional', () => {
    const schema = t.object({ name: t.string(), nick: t.optional(t.string()) });

    it('accepts when the optional field is absent', () => {
      expect(validateSchema(schema, { name: 'Alex' }, opts)).toBe(true);
    });

    it('accepts when the optional field is present and valid', () => {
      expect(validateSchema(schema, { name: 'Alex', nick: 'A' }, opts)).toBe(
        true,
      );
    });

    it('rejects when the optional field is present but wrong type', () => {
      expect(validateSchema(schema, { name: 'Alex', nick: 9 }, opts)).toBe(
        false,
      );
    });
  });

  describe('array', () => {
    const schema = t.array(t.string());

    it('accepts a homogeneous array', () => {
      expect(validateSchema(schema, ['a', 'b'], opts)).toBe(true);
    });

    it('accepts an empty array', () => {
      expect(validateSchema(schema, [], opts)).toBe(true);
    });

    it('rejects when an element is the wrong type', () => {
      expect(validateSchema(schema, ['a', 3], opts)).toBe(false);
    });

    it('rejects a non-array', () => {
      expect(validateSchema(schema, { 0: 'a' }, opts)).toBe(false);
    });
  });

  describe('nested', () => {
    const schema = t.object({
      user: t.object({ id: t.number(), tags: t.array(t.string()) }),
    });

    it('validates recursively through objects and arrays', () => {
      expect(
        validateSchema(schema, { user: { id: 1, tags: ['x'] } }, opts),
      ).toBe(true);
    });

    it('rejects a deep mismatch', () => {
      expect(
        validateSchema(schema, { user: { id: 1, tags: [2] } }, opts),
      ).toBe(false);
    });
  });

  describe('unknown keys', () => {
    const schema = t.object({ name: t.string() });

    it('ignores unknown keys by default', () => {
      const data = { name: 'Alex', extra: 1 };
      expect(validateSchema(schema, data, opts)).toBe(true);
      expect(data.extra).toBe(1);
    });

    it('rejects unknown keys when forbidden is on', () => {
      const data = { name: 'Alex', extra: 1 };
      expect(
        validateSchema(schema, data, { whitelist: false, forbidden: true }),
      ).toBe(false);
    });

    it('strips unknown keys when whitelist is on', () => {
      const data: Record<string, unknown> = { name: 'Alex', extra: 1 };
      expect(
        validateSchema(schema, data, { whitelist: true, forbidden: false }),
      ).toBe(true);
      expect('extra' in data).toBe(false);
      expect(data.name).toBe('Alex');
    });
  });

  it('infers the static type from a schema', () => {
    const userSchema = t.object({ name: t.string(), age: t.number() });
    const u: Static<typeof userSchema> = { name: 'Alex', age: 21 };
    expect(u.name).toBe('Alex');
  });
});
