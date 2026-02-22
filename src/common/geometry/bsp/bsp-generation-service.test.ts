/**
 * Tests for BspGenerationService.
 * 
 * Mocking strategy:
 * - Store connector: mock connect() to capture callbacks for manual invocation
 * - window.electronAPI: mock on/off for IPC channel registration
 * - Worker: mock constructor and instance methods (postMessage, addEventListener, terminate)
 * - Timers: jest fake timers for debounce testing
 * - Store dispatch: mock useAppDispatch
 */

// ---- Mocks must be set up BEFORE imports ----

/// <reference path="../../../renderer/electron.d.ts" />

// Track store connector callbacks
const connectCallbacks: Function[] = [];
jest.mock('../../store/store-connector', () => ({
    connect: jest.fn((cb: Function) => {
        connectCallbacks.push(cb);
        // Don't call cb immediately — tests will drive state changes manually
        return jest.fn(); // mock unsubscribe
    }),
}));

// Mock the store's dispatch
const mockDispatch = jest.fn();
jest.mock('../../store', () => ({
    useAppDispatch: () => mockDispatch,
    __esModule: true,
    default: {
        getState: jest.fn(),
        dispatch: mockDispatch,
        subscribe: jest.fn(),
    },
}));

// Mock window.electronAPI — add to existing jsdom window, don't replace it
const ipcHandlers: Record<string, Function[]> = {};
const mockElectronAPI = {
    on: jest.fn((channel: string, handler: Function) => {
        if (!ipcHandlers[channel]) ipcHandlers[channel] = [];
        ipcHandlers[channel].push(handler);
    }),
    off: jest.fn((channel: string, handler: Function) => {
        if (ipcHandlers[channel]) {
            ipcHandlers[channel] = ipcHandlers[channel].filter(h => h !== handler);
        }
    }),
};
Object.defineProperty(window, 'electronAPI', { value: mockElectronAPI, writable: true });

// Mock Worker
let lastWorkerInstance: any = null;
const mockWorkerConstructor = jest.fn().mockImplementation(() => {
    const instance = {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        terminate: jest.fn(),
    };
    lastWorkerInstance = instance;
    return instance;
});
(global as any).Worker = mockWorkerConstructor;

// ---- Now import the service ----
import { BspGenerationService } from './bsp-generation-service';
import { setBsp, setRebuilding } from '../../store/bsp-state';
import { NULL_NODE } from './model';

// Helper: get the latest connect callback
function getConnectCallback(): Function {
    return connectCallbacks[connectCallbacks.length - 1];
}

// Helper: simulate a state change from the store
function simulateStateChange(bspState: { status: string; dirtyCount: number; tree?: any; dirtyEdges?: any }, polygonCount: number = 3) {
    const state = {
        walls: {
            geometry: {
                polygons: polygonCount > 0 ? new Array(polygonCount).fill({ edges: [] }) : [],
                edgeCount: 0,
                bounds: [0, 0],
            },
        },
        bsp: {
            tree: bspState.tree ?? null,
            status: bspState.status,
            dirtyEdges: bspState.dirtyEdges ?? { removedEdgeIds: new Set(), addedEdgeIds: new Set(), modifiedEdgeIds: new Set() },
            dirtyCount: bspState.dirtyCount,
        },
    };
    getConnectCallback()(state);
}

// Helper: get the worker message handler
function getWorkerMessageHandler(): Function | null {
    if (!lastWorkerInstance) return null;
    const calls = lastWorkerInstance.addEventListener.mock.calls;
    const messageCall = calls.find((c: any[]) => c[0] === 'message');
    return messageCall ? messageCall[1] : null;
}

// Helper: simulate worker completing with a BSP tree
function simulateWorkerComplete(generationId: number, tree: any = NULL_NODE) {
    const handler = getWorkerMessageHandler();
    if (handler) {
        handler({ data: { tree, generationId } });
    }
}

describe('BspGenerationService', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        connectCallbacks.length = 0;
        mockDispatch.mockClear();
        mockWorkerConstructor.mockClear();
        lastWorkerInstance = null;
        // Clear IPC handlers
        for (const key of Object.keys(ipcHandlers)) {
            delete ipcHandlers[key];
        }
        (mockElectronAPI.on as jest.Mock).mockClear();
        (mockElectronAPI.off as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('constructor', () => {
        it('registers IPC listener for bsp_generate', () => {
            const service = new BspGenerationService();
            expect(window.electronAPI.on).toHaveBeenCalledWith('bsp_generate', expect.any(Function));
            service.dispose();
        });

        it('subscribes to store via connect()', () => {
            const service = new BspGenerationService();
            expect(connectCallbacks.length).toBe(1);
            service.dispose();
        });
    });

    describe('dispose', () => {
        it('removes IPC listener', () => {
            const service = new BspGenerationService();
            service.dispose();
            expect(window.electronAPI.off).toHaveBeenCalledWith('bsp_generate', expect.any(Function));
        });

        it('terminates worker if running', () => {
            const service = new BspGenerationService();
            // Trigger generation
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(500);
            expect(lastWorkerInstance).not.toBeNull();

            service.dispose();
            expect(lastWorkerInstance!.terminate).toHaveBeenCalled();
        });

        it('cancels pending debounce timer', () => {
            const service = new BspGenerationService();
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            // Debounce is pending but not yet fired
            expect(mockWorkerConstructor).not.toHaveBeenCalled();

            service.dispose();
            jest.advanceTimersByTime(1000);
            // Worker should NOT have been created because dispose cancelled the timer
            expect(mockWorkerConstructor).not.toHaveBeenCalled();
        });
    });

    describe('debounced generation on stale status', () => {
        it('starts debounce when status becomes stale', () => {
            const service = new BspGenerationService(200);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });

            // Worker not yet created (debounce pending)
            expect(mockWorkerConstructor).not.toHaveBeenCalled();

            // Advance past debounce
            jest.advanceTimersByTime(200);

            // Now worker should be created
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith(setRebuilding());
            service.dispose();
        });

        it('does not restart debounce on unrelated state changes while debounce is pending', () => {
            const service = new BspGenerationService(200);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });

            // Advance 150ms (still within debounce window)
            jest.advanceTimersByTime(150);
            expect(mockWorkerConstructor).not.toHaveBeenCalled();

            // Simulate unrelated state change (status still stale, same dirtyCount)
            simulateStateChange({ status: 'stale', dirtyCount: 1 });

            // Advance another 50ms — original debounce should fire
            jest.advanceTimersByTime(50);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            service.dispose();
        });

        it('posts geometry to worker with generationId', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);

            expect(lastWorkerInstance!.postMessage).toHaveBeenCalledWith({
                polygons: expect.any(Array),
                generationId: 1,
            });
            service.dispose();
        });

        it('does not start debounce when already generating', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);

            // Simulate more edits while worker is running
            // Status stays 'rebuilding' (markDirty doesn't change from rebuilding)
            simulateStateChange({ status: 'rebuilding', dirtyCount: 2 });

            jest.advanceTimersByTime(500);
            // Should NOT create another worker while one is running
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            service.dispose();
        });
    });

    describe('immediate generation on none status', () => {
        it('generates immediately when status is none and geometry exists', () => {
            const service = new BspGenerationService();
            simulateStateChange({ status: 'none', dirtyCount: 0 }, 5);

            // Should create worker immediately (no debounce)
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith(setRebuilding());
            service.dispose();
        });

        it('does not generate when status is none but no polygons', () => {
            const service = new BspGenerationService();
            simulateStateChange({ status: 'none', dirtyCount: 0 }, 0);

            expect(mockWorkerConstructor).not.toHaveBeenCalled();
            service.dispose();
        });
    });

    describe('file load scenarios', () => {
        it('does not generate when file loads with stored BSP (setBsp sets fresh)', () => {
            const service = new BspGenerationService();
            // Simulate loadWorld dispatching setBsp(tree) → status becomes 'fresh'
            simulateStateChange({ status: 'fresh', dirtyCount: 0, tree: NULL_NODE }, 5);

            // No worker should be spawned — loaded BSP is sufficient
            expect(mockWorkerConstructor).not.toHaveBeenCalled();
            service.dispose();
        });

        it('generates immediately when file loads without BSP (setBsp(null) sets none)', () => {
            const service = new BspGenerationService();
            // Simulate loadWorld dispatching setBsp(null) → status becomes 'none'
            simulateStateChange({ status: 'none', dirtyCount: 0 }, 5);

            // Worker should be spawned immediately (no debounce)
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith(setRebuilding());
            service.dispose();
        });

        it('does not generate on new file (empty geometry, status none)', () => {
            const service = new BspGenerationService();
            // Simulate clear() → loadWorld({}) → setBsp(null) with empty geometry
            simulateStateChange({ status: 'none', dirtyCount: 0 }, 0);

            // No worker — nothing to generate
            expect(mockWorkerConstructor).not.toHaveBeenCalled();
            service.dispose();
        });
    });

    describe('Ctrl+B force immediate', () => {
        it('triggers immediate generation via IPC', () => {
            const service = new BspGenerationService(500);
            // First set up geometry
            simulateStateChange({ status: 'fresh', dirtyCount: 0 }, 5);

            // Make it stale so there's something to generate
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            // Debounce is pending...

            // Fire Ctrl+B
            ipcHandlers['bsp_generate']?.[0]?.();

            // Should generate immediately, cancelling debounce
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith(setRebuilding());

            // Advancing past debounce should NOT trigger another generation
            jest.advanceTimersByTime(500);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            service.dispose();
        });

        it('cancels in-flight worker and starts new generation', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);
            const firstWorker = lastWorkerInstance;
            expect(firstWorker).not.toBeNull();

            // Need to set up geometry for the force immediate
            simulateStateChange({ status: 'rebuilding', dirtyCount: 1 });

            // Ctrl+B while worker is running
            ipcHandlers['bsp_generate']?.[0]?.();

            expect(firstWorker!.terminate).toHaveBeenCalled();
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(2);
            service.dispose();
        });
    });

    describe('worker completion', () => {
        it('dispatches setBsp on successful completion', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);

            const mockTree = { type: 'leaf' as const, polygons: [], count: 0, bounds: [[0,0],[0,0]] as [[number,number],[number,number]] };
            simulateWorkerComplete(1, mockTree);

            expect(mockDispatch).toHaveBeenCalledWith(setBsp(mockTree));
            service.dispose();
        });

        it('terminates worker after completion', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);
            const worker = lastWorkerInstance;

            simulateWorkerComplete(1);

            expect(worker!.terminate).toHaveBeenCalled();
            service.dispose();
        });

        it('discards stale results with wrong generationId', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);

            // Worker responds with wrong generationId
            simulateWorkerComplete(999);

            // setBsp should NOT have been dispatched (setRebuilding was dispatched earlier)
            const setBspCalls = mockDispatch.mock.calls.filter(
                (call: any[]) => call[0]?.type === 'bsp/setBsp'
            );
            expect(setBspCalls).toHaveLength(0);
            service.dispose();
        });

        it('increments generationId for each generation', () => {
            const service = new BspGenerationService(100);

            // First generation
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);
            expect(lastWorkerInstance!.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ generationId: 1 })
            );
            simulateWorkerComplete(1);

            // Make stale again
            simulateStateChange({ status: 'stale', dirtyCount: 2 });
            jest.advanceTimersByTime(100);
            expect(lastWorkerInstance!.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ generationId: 2 })
            );
            service.dispose();
        });
    });

    describe('edits during generation (Option A)', () => {
        it('queues new generation when dirtyCount changes during worker run', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);

            // New edit arrives while worker is running — dirtyCount changes
            simulateStateChange({ status: 'rebuilding', dirtyCount: 2 });

            // Worker completes
            simulateWorkerComplete(1);

            // Should accept the result
            expect(mockDispatch).toHaveBeenCalledWith(setBsp(expect.anything()));

            // Should have queued a new debounced generation
            // The setBsp dispatch sets status to 'fresh' and dirtyCount to 0,
            // but the service detected the mismatch BEFORE dispatching setBsp
            jest.advanceTimersByTime(100);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(2);
            service.dispose();
        });

        it('does not queue new generation when no edits during worker run', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });
            jest.advanceTimersByTime(100);

            // Worker completes with no intervening edits
            simulateWorkerComplete(1);

            // Advance timers — no new generation should be queued
            jest.advanceTimersByTime(500);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            service.dispose();
        });
    });

    describe('edge cases', () => {
        it('skips generation when geometry has no polygons', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'stale', dirtyCount: 1 }, 0);
            jest.advanceTimersByTime(100);

            // setRebuilding is NOT dispatched because startGeneration bails out
            const rebuildCalls = mockDispatch.mock.calls.filter(
                (call: any[]) => call[0]?.type === 'bsp/setRebuilding'
            );
            expect(rebuildCalls).toHaveLength(0);
            expect(mockWorkerConstructor).not.toHaveBeenCalled();
            service.dispose();
        });

        it('does not trigger on fresh status', () => {
            const service = new BspGenerationService(100);
            simulateStateChange({ status: 'fresh', dirtyCount: 0 });

            jest.advanceTimersByTime(1000);
            expect(mockWorkerConstructor).not.toHaveBeenCalled();
            service.dispose();
        });

        it('accepts custom debounce delay', () => {
            const service = new BspGenerationService(1000);
            simulateStateChange({ status: 'stale', dirtyCount: 1 });

            jest.advanceTimersByTime(999);
            expect(mockWorkerConstructor).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
            service.dispose();
        });
    });
});
