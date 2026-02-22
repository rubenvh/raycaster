import { useAppDispatch } from '../../store';
import { connect } from '../../store/store-connector';
import { setBsp, setRebuilding, IBspState } from '../../store/bsp-state';
import { EMPTY_GEOMETRY, IGeometry } from '../geometry';
import { BspWorkerRequest, BspWorkerResponse } from '../../../workers/bspGenerator';

/// <reference path="../../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

/** Default debounce delay in milliseconds before triggering BSP generation. */
const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Automatic BSP generation service that replaces the manual Ctrl+B workflow.
 * 
 * Listens for geometry changes via the Redux store and automatically triggers
 * debounced BSP tree rebuilds using a web worker. Also supports immediate
 * generation via the Ctrl+B IPC channel.
 * 
 * Edits-during-generation strategy (Option A):
 * When a worker completes, the result is always accepted (it's better than
 * nothing). If new edits arrived while the worker was running (detected by
 * comparing dirtyCount snapshots), a new debounced generation is queued
 * immediately.
 */
export class BspGenerationService {
    private worker: Worker | null = null;
    private workerMessageHandler: ((e: MessageEvent) => void) | null = null;
    private geometry: IGeometry = EMPTY_GEOMETRY;
    private generationId: number = 0;
    private dirtyCountSnapshot: number = 0;
    private currentDirtyCount: number = 0;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private unsubscribe: () => void;
    private needsRegeneration: boolean = false;
    private debounceMs: number;

    constructor(debounceMs: number = DEFAULT_DEBOUNCE_MS) {
        this.debounceMs = debounceMs;

        // Listen for Ctrl+B → force immediate generation
        window.electronAPI.on('bsp_generate', this.forceImmediate);

        // Subscribe to store for geometry and BSP state changes.
        // connect() fires synchronously on every Redux dispatch, so
        // currentDirtyCount is always up-to-date when we read it.
        this.unsubscribe = connect(state => {
            this.geometry = state.walls.geometry;
            this.currentDirtyCount = state.bsp.dirtyCount;
            this.onStateChange(state.bsp);
        });
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('bsp_generate', this.forceImmediate);
        this.cancelDebounce();
        this.terminateWorker();
    }

    /**
     * React to BSP state changes from the store.
     * 
     * Triggers debounced generation when status becomes 'stale' and no
     * generation is in progress. When status is 'none' and geometry exists,
     * triggers immediate generation (e.g., after file load with no stored BSP).
     * 
     * During 'rebuilding', tracks whether new dirty edges arrived so we can
     * queue a follow-up generation when the current one completes.
     */
    private onStateChange(bspState: IBspState): void {
        const { status, dirtyCount } = bspState;

        if (status === 'stale' && !this.isGenerating() && this.debounceTimer === null) {
            this.startDebounce();
        } else if (status === 'none' && this.geometry.polygons.length > 0 && !this.isGenerating()) {
            // Geometry exists but no BSP — generate immediately (e.g., fresh load)
            this.startGeneration();
        } else if (status === 'rebuilding' && dirtyCount !== this.dirtyCountSnapshot) {
            // New edits arrived while worker is running — flag for re-generation
            this.needsRegeneration = true;
        }
    }

    /** Whether a web worker is currently running a BSP generation. */
    private isGenerating(): boolean {
        return this.worker !== null;
    }

    /** Cancel any pending debounce timer. */
    private cancelDebounce(): void {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    /** Start or restart the debounce timer. */
    private startDebounce(): void {
        this.cancelDebounce();
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.startGeneration();
        }, this.debounceMs);
    }

    /** Force immediate generation (Ctrl+B). Cancels debounce and in-flight work. */
    private forceImmediate = (): void => {
        this.cancelDebounce();
        this.startGeneration();
    };

    /**
     * Start a BSP generation cycle.
     * 
     * Terminates any in-flight worker, creates a new one, and posts the
     * current geometry to it. Snapshots the dirty count so we can detect
     * edits that arrive while the worker is running.
     */
    private startGeneration(): void {
        this.terminateWorker();
        this.cancelDebounce();
        this.needsRegeneration = false;

        const polygons = this.geometry.polygons;
        if (polygons.length === 0) return;

        this.generationId++;
        this.dirtyCountSnapshot = this.currentDirtyCount;

        dispatch(setRebuilding());

        this.worker = new Worker('../workers/dist/bspGenerator-bundle.js');
        const request: BspWorkerRequest = { polygons, generationId: this.generationId };
        this.worker.postMessage(request);

        this.workerMessageHandler = (e: MessageEvent) => {
            this.onWorkerMessage(e);
        };
        this.worker.addEventListener('message', this.workerMessageHandler);
    }

    /**
     * Handle the completed BSP tree from the worker.
     * 
     * Discards stale results (generationId mismatch). Accepts valid results
     * and dispatches setBsp. If new edits arrived during generation, queues
     * another debounced generation.
     */
    private onWorkerMessage(e: MessageEvent): void {
        const response = e.data as BspWorkerResponse;

        // Discard stale results from a previous generation cycle
        if (response.generationId !== this.generationId) return;

        // Check BEFORE dispatching setBsp, because setBsp resets dirtyCount to 0
        // and the synchronous connect() callback would update currentDirtyCount
        // before we can compare it to the snapshot.
        const editsArrivedDuringGeneration = 
            this.needsRegeneration || this.currentDirtyCount !== this.dirtyCountSnapshot;

        // Accept the result
        dispatch(setBsp(response.tree));
        this.terminateWorker();

        // If edits arrived during generation, queue a new build
        if (editsArrivedDuringGeneration) {
            this.needsRegeneration = false;
            this.startDebounce();
        }
    }

    /** Terminate the current worker and clean up its event listener. */
    private terminateWorker(): void {
        if (this.worker) {
            if (this.workerMessageHandler) {
                this.worker.removeEventListener('message', this.workerMessageHandler);
                this.workerMessageHandler = null;
            }
            this.worker.terminate();
            this.worker = null;
        }
    }
}
