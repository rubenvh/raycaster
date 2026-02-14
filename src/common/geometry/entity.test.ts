import { createEntityKey, giveIdentity, cloneKey, IEntity } from './entity';

describe('entity tests', () => {
    describe('createEntityKey', () => {
        it('creates a non-empty string key', () => {
            const key = createEntityKey();
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        });

        it('creates unique keys on each call', () => {
            const key1 = createEntityKey();
            const key2 = createEntityKey();
            const key3 = createEntityKey();
            expect(key1).not.toBe(key2);
            expect(key2).not.toBe(key3);
            expect(key1).not.toBe(key3);
        });

        it('creates GUID-formatted keys', () => {
            const key = createEntityKey();
            // GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            expect(key).toMatch(guidRegex);
        });
    });

    describe('giveIdentity', () => {
        it('adds id to entity without id', () => {
            const entity: IEntity = {};
            const result = giveIdentity(entity);
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
        });

        it('preserves existing id', () => {
            const existingId = 'my-existing-id';
            const entity: IEntity = { id: existingId };
            const result = giveIdentity(entity);
            expect(result.id).toBe(existingId);
        });

        it('preserves other properties', () => {
            const entity = { name: 'test', value: 42 } as IEntity & { name: string; value: number };
            const result = giveIdentity(entity);
            expect(result.name).toBe('test');
            expect(result.value).toBe(42);
            expect(result.id).toBeDefined();
        });

        it('returns new object when adding id', () => {
            const entity: IEntity = {};
            const result = giveIdentity(entity);
            expect(result).not.toBe(entity);
        });

        it('returns same object when id exists', () => {
            const entity: IEntity = { id: 'existing' };
            const result = giveIdentity(entity);
            expect(result).toBe(entity);
        });
    });

    describe('cloneKey', () => {
        it('clones a string key', () => {
            const key = 'test-key-123';
            const cloned = cloneKey(key);
            expect(cloned).toBe(key);
        });

        it('handles undefined key', () => {
            const result = cloneKey(undefined as any);
            expect(result).toBeUndefined();
        });

        it('clones generated entity key', () => {
            const key = createEntityKey();
            const cloned = cloneKey(key);
            expect(cloned).toBe(key);
        });
    });
});
