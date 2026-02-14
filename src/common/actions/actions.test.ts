import { makeFlag, isActive, activate, deactivate, reset, Flag, bindFlagToKey, bindCallbackToKey, ALL_ACTIONS } from './actions';

// ─── Flag Utilities ──────────────────────────────────────────────

describe('makeFlag', () => {
    test('creates flag with value false', () => {
        const flag = makeFlag();
        expect(flag.value).toBe(false);
        expect(flag.blockKeyDown).toBeUndefined();
    });
});

describe('isActive', () => {
    test('returns false for fresh flag', () => {
        expect(isActive(makeFlag())).toBe(false);
    });

    test('returns true when value is true and not blocked', () => {
        const flag: Flag = { value: true };
        expect(isActive(flag)).toBe(true);
    });

    test('returns false when blocked', () => {
        const flag: Flag = { value: true, blockKeyDown: true };
        expect(isActive(flag)).toBe(false);
    });

    test('returns false when value is false even if not blocked', () => {
        const flag: Flag = { value: false, blockKeyDown: false };
        expect(isActive(flag)).toBe(false);
    });
});

describe('activate', () => {
    test('sets value to true', () => {
        const flag = makeFlag();
        activate(flag);
        expect(flag.value).toBe(true);
    });

    test('does not affect blockKeyDown', () => {
        const flag: Flag = { value: false, blockKeyDown: true };
        activate(flag);
        expect(flag.value).toBe(true);
        expect(flag.blockKeyDown).toBe(true);
    });
});

describe('deactivate', () => {
    test('sets blockKeyDown to true', () => {
        const flag = makeFlag();
        activate(flag);
        deactivate(flag);
        expect(flag.blockKeyDown).toBe(true);
        // value remains true — blocked via blockKeyDown
        expect(flag.value).toBe(true);
        expect(isActive(flag)).toBe(false);
    });
});

describe('reset', () => {
    test('sets both value and blockKeyDown to false', () => {
        const flag: Flag = { value: true, blockKeyDown: true };
        reset(flag);
        expect(flag.value).toBe(false);
        expect(flag.blockKeyDown).toBe(false);
    });
});

describe('flag lifecycle', () => {
    test('full cycle: make -> activate -> deactivate -> reset', () => {
        const flag = makeFlag();
        expect(isActive(flag)).toBe(false);

        activate(flag);
        expect(isActive(flag)).toBe(true);

        deactivate(flag);
        expect(isActive(flag)).toBe(false);
        expect(flag.value).toBe(true); // still true, just blocked

        reset(flag);
        expect(isActive(flag)).toBe(false);
        expect(flag.value).toBe(false);
        expect(flag.blockKeyDown).toBe(false);
    });
});


// ─── Key Binding ─────────────────────────────────────────────────

describe('bindFlagToKey', () => {
    let listeners: Map<string, Function[]>;
    let mockTarget: GlobalEventHandlers;

    beforeEach(() => {
        listeners = new Map();
        mockTarget = {
            addEventListener: jest.fn((type: string, handler: Function) => {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type)!.push(handler);
            }),
            removeEventListener: jest.fn((type: string, handler: Function) => {
                const arr = listeners.get(type);
                if (arr) {
                    const idx = arr.indexOf(handler);
                    if (idx !== -1) arr.splice(idx, 1);
                }
            }),
        } as any;
    });

    const fireKey = (type: string, keyCode: number, ctrlKey = false) => {
        const handlers = listeners.get(type) || [];
        handlers.forEach(h => h({ keyCode, ctrlKey } as KeyboardEvent));
    };

    test('activates flag on matching keydown', () => {
        const flag = makeFlag();
        bindFlagToKey(mockTarget, 'up', flag); // W = 87
        fireKey('keydown', 87);
        expect(flag.value).toBe(true);
    });

    test('resets flag on matching keyup', () => {
        const flag = makeFlag();
        bindFlagToKey(mockTarget, 'up', flag);
        fireKey('keydown', 87);
        expect(flag.value).toBe(true);
        fireKey('keyup', 87);
        expect(flag.value).toBe(false);
    });

    test('ignores non-matching keydown', () => {
        const flag = makeFlag();
        bindFlagToKey(mockTarget, 'up', flag);
        fireKey('keydown', 65); // A key, not W
        expect(flag.value).toBe(false);
    });

    test('handles ctrl-modified keys', () => {
        const flag = makeFlag();
        bindFlagToKey(mockTarget, 'camera_depth_up', flag); // ctrl + 107
        fireKey('keydown', 107, false); // without ctrl — should not activate
        expect(flag.value).toBe(false);
        fireKey('keydown', 107, true); // with ctrl — should activate
        expect(flag.value).toBe(true);
    });

    test('dispose removes listeners', () => {
        const flag = makeFlag();
        const dispose = bindFlagToKey(mockTarget, 'up', flag);
        expect(mockTarget.addEventListener).toHaveBeenCalledTimes(2); // keydown + keyup
        dispose();
        expect(mockTarget.removeEventListener).toHaveBeenCalledTimes(2);
        // After dispose, keys should not affect flag
        fireKey('keydown', 87);
        expect(flag.value).toBe(false);
    });
});

describe('bindCallbackToKey', () => {
    let listeners: Map<string, Function[]>;
    let mockTarget: GlobalEventHandlers;

    beforeEach(() => {
        listeners = new Map();
        mockTarget = {
            addEventListener: jest.fn((type: string, handler: Function) => {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type)!.push(handler);
            }),
            removeEventListener: jest.fn((type: string, handler: Function) => {
                const arr = listeners.get(type);
                if (arr) {
                    const idx = arr.indexOf(handler);
                    if (idx !== -1) arr.splice(idx, 1);
                }
            }),
        } as any;
    });

    const fireKey = (type: string, keyCode: number, ctrlKey = false) => {
        const handlers = listeners.get(type) || [];
        handlers.forEach(h => h({ keyCode, ctrlKey } as KeyboardEvent));
    };

    test('calls callback on matching keydown', () => {
        const cb = jest.fn();
        bindCallbackToKey(mockTarget, 'toggle_test_canvas', cb); // TAB = 9
        fireKey('keydown', 9);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    test('ignores non-matching keys', () => {
        const cb = jest.fn();
        bindCallbackToKey(mockTarget, 'toggle_test_canvas', cb);
        fireKey('keydown', 87); // W, not TAB
        expect(cb).not.toHaveBeenCalled();
    });

    test('handles ctrl-modified callback key', () => {
        const cb = jest.fn();
        bindCallbackToKey(mockTarget, 'toggle_draw_bsp', cb); // ctrl+TAB
        fireKey('keydown', 9, false); // no ctrl
        expect(cb).not.toHaveBeenCalled();
        fireKey('keydown', 9, true); // with ctrl
        expect(cb).toHaveBeenCalledTimes(1);
    });

    test('dispose removes listener', () => {
        const cb = jest.fn();
        const dispose = bindCallbackToKey(mockTarget, 'toggle_test_canvas', cb);
        expect(mockTarget.addEventListener).toHaveBeenCalledTimes(1); // only keydown
        dispose();
        expect(mockTarget.removeEventListener).toHaveBeenCalledTimes(1);
        fireKey('keydown', 9);
        expect(cb).not.toHaveBeenCalled();
    });
});


// ─── ALL_ACTIONS constant ────────────────────────────────────────

describe('ALL_ACTIONS', () => {
    test('contains expected actions', () => {
        expect(ALL_ACTIONS).toContain('up');
        expect(ALL_ACTIONS).toContain('down');
        expect(ALL_ACTIONS).toContain('left');
        expect(ALL_ACTIONS).toContain('right');
        expect(ALL_ACTIONS).toContain('turnleft');
        expect(ALL_ACTIONS).toContain('turnright');
        expect(ALL_ACTIONS).toContain('toggle_test_canvas');
        expect(ALL_ACTIONS).toContain('toggle_draw_bsp');
    });

    test('has 12 actions', () => {
        expect(ALL_ACTIONS.length).toBe(12);
    });
});
