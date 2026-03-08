/**
 * Dance action handler: IActionHandler implementation that wires all dance
 * components together and drives the camera from live audio.
 * 
 * Responsibilities:
 * - Owns AudioCaptureService, BeatDetector, MoodMachine, DanceChoreographer
 * - Builds NavGraph and analyzes geometry on initialization
 * - Each frame: feeds audio → beat detector → mood machine → choreographer → camera
 * - Applies DanceMovement deltas to the camera via Redux store
 * 
 * This handler replaces CameraActionsHandler when dance mode is active.
 */
import { IActionHandler } from './actions';
import { ICamera } from '../camera';
import { IGeometry, EMPTY_GEOMETRY } from '../geometry/geometry';
import { IBspContext } from '../store/bsp-state';
import { useAppDispatch } from '../store';
import { moveCamera, strafeCamera, rotateCamera } from '../store/player';
import { connect } from '../store/store-connector';
import { AudioCaptureService } from '../audio/audio-capture';
import { BeatDetector } from '../audio/beat-detector';
import { MoodMachine } from '../audio/mood-machine';
import { DanceChoreographer } from '../audio/dance-choreographer';
import { AudioFeatures, EMPTY_AUDIO_FEATURES, EMPTY_BEAT_STATE, INITIAL_MOOD_STATE, BeatState, MoodState } from '../audio/model';
import { WallProximityInfo } from '../audio/dance-choreographer';
import { buildNavGraph, findNearestNode, collectSolidEdges } from '../navigation/nav-graph';
import { findPathBetweenPositions } from '../navigation/pathfinder';
import { analyzeGeometry, buildTour } from '../navigation/geometry-analyzer';
import { NavGraph, NavPath } from '../navigation/model';
import { Vector, normalize, subtract, distance as vecDistance } from '../math/vector';
import { IEdge } from '../geometry/edge';
import { distanceTo } from '../math/lineSegment';

const dispatch = useAppDispatch();

// ============================================================================
// Dance Action Handler
// ============================================================================

export class DanceActionHandler implements IActionHandler {
    // Audio pipeline
    private audioCapture: AudioCaptureService;
    private beatDetector: BeatDetector;
    private moodMachine: MoodMachine;
    private choreographer: DanceChoreographer;

    // Latest audio features (written by audio callback, read by handle())
    private latestFeatures: AudioFeatures = EMPTY_AUDIO_FEATURES;
    private latestBeat: BeatState = { ...EMPTY_BEAT_STATE };
    private latestMood: MoodState = { ...INITIAL_MOOD_STATE };

    // Navigation
    private navGraph: NavGraph | null = null;
    private navInitialized = false;
    private solidEdges: IEdge[] = [];

    // Store state (kept in sync via connect())
    private wallGeometry: IGeometry = EMPTY_GEOMETRY;
    private bspContext: IBspContext | null = null;
    private camera: ICamera;

    private unsubscribe: () => void;
    private audioStarted = false;
    private active = true;
    private frameCount = 0;
    private logInterval = 120; // Log every ~2 seconds at 60fps

    constructor() {
        // Create audio pipeline components
        this.audioCapture = new AudioCaptureService();
        this.beatDetector = new BeatDetector();
        this.moodMachine = new MoodMachine();
        this.choreographer = new DanceChoreographer();

        // Subscribe to store for geometry and camera state
        this.unsubscribe = connect(s => {
            this.wallGeometry = s.walls.geometry;
            this.camera = s.player.camera;
            this.bspContext = { tree: s.bsp.treeHolder?.node ?? null, dirtyEdges: s.bsp.dirtyEdges };

            // Initialize navigation when geometry becomes available
            if (!this.navInitialized && this.wallGeometry.polygons.length > 0) {
                this.initializeNavigation();
            }
        });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        // Dance mode doesn't bind keyboard keys for camera control.
        // ESC is handled separately by the player, not by this handler.
        // Start audio capture (async — will begin producing features once ready).
        this.startAudio();
        return this;
    }

    handle(deltaTime: number): void {
        if (!this.active) return;

        // Update choreographer with current camera state
        if (this.camera) {
            this.choreographer.updateCameraState(
                this.camera.position,
                this.camera.direction
            );
        }

        // Run beat detector on latest audio features
        this.latestBeat = this.beatDetector.process(this.latestFeatures);

        // Run mood machine
        // Mood machine expects deltaTime in ms
        this.latestMood = this.moodMachine.process(
            this.latestFeatures,
            this.latestBeat,
            deltaTime * 1000
        );

        // Run choreographer to get movement deltas
        const movement = this.choreographer.process(
            this.latestMood,
            this.latestBeat,
            deltaTime
        );

        // Apply movement to camera via Redux store
        this.applyMovement(movement.forward, movement.strafe, movement.rotation);

        // Periodic diagnostic logging
        this.frameCount++;
        if (this.frameCount % this.logInterval === 0) {
            console.log(`[Dance] mood=${this.latestMood.current} intensity=${this.latestMood.intensity.toFixed(2)} rms=${this.latestFeatures.rms.toFixed(4)} flux=${this.latestFeatures.spectralFlux.toFixed(4)} beat=${this.latestBeat.isBeat} bpm=${this.latestBeat.bpm.toFixed(0)} fwd=${movement.forward.toFixed(4)} strafe=${movement.strafe.toFixed(4)} rot=${movement.rotation.toFixed(4)}`);
        }
    }

    isActive = () => this.active;

    /**
     * Returns the current A* path waypoints and active waypoint index.
     * Used by the minimap to display the planned path in dance mode.
     */
    getCurrentPath(): { waypoints: Vector[]; waypointIndex: number } {
        return {
            waypoints: this.choreographer.getCurrentPath(),
            waypointIndex: this.choreographer.getCurrentWaypointIndex(),
        };
    }

    dispose(): void {
        this.active = false;
        this.audioCapture.stop();
        this.unsubscribe();
    }

    // ========================================================================
    // Audio
    // ========================================================================

    private async startAudio(): Promise<void> {
        if (this.audioStarted) return;
        this.audioStarted = true;

        try {
            await this.audioCapture.start((features: AudioFeatures) => {
                // This callback is called from the audio thread at ~86Hz (44100/512)
                // We just store the latest features; handle() reads them each frame
                this.latestFeatures = features;
            });
            console.log('[Dance] Audio capture started');
        } catch (err) {
            console.error('[Dance] Failed to start audio capture:', err);
            // Continue without audio — the mood machine will stay in SILENT,
            // and the choreographer will produce gentle drift movement
        }
    }

    // ========================================================================
    // Navigation initialization
    // ========================================================================

    private initializeNavigation(): void {
        this.navInitialized = true;
        console.log('[Dance] Building navigation graph...');

        try {
            // Build nav graph from geometry
            this.navGraph = buildNavGraph(this.wallGeometry);
            console.log(`[Dance] Nav graph built: ${this.navGraph.nodes.length} nodes`);

            // Collect solid edges for wall proximity sensing
            this.solidEdges = collectSolidEdges(this.wallGeometry);
            console.log(`[Dance] Collected ${this.solidEdges.length} solid edges for wall proximity`);

            if (this.navGraph.nodes.length === 0) {
                console.warn('[Dance] No walkable nodes found — camera will drift freely');
                return;
            }

            // Analyze geometry for interesting locations
            const analysis = analyzeGeometry(this.wallGeometry, this.navGraph);
            console.log(`[Dance] Found ${analysis.pointsOfInterest.length} points of interest`);

            // Build a tour through the POIs
            const tour = buildTour(analysis.pointsOfInterest);
            if (tour.length > 0) {
                this.choreographer.setTour(tour);
                console.log(`[Dance] Tour built with ${tour.length} waypoints`);
            }

            // Provide pathfinder to choreographer
            const graph = this.navGraph;
            this.choreographer.setPathfinder((from: Vector, to: Vector): NavPath => {
                return findPathBetweenPositions(graph, from, to, findNearestNode);
            });

            // Provide wall proximity callback to choreographer
            const edges = this.solidEdges;
            this.choreographer.setWallProximity((position: Vector): WallProximityInfo => {
                return computeWallProximity(position, edges);
            });
        } catch (err) {
            console.error('[Dance] Navigation initialization failed:', err);
        }
    }

    // ========================================================================
    // Movement application
    // ========================================================================

    /**
     * Apply choreographer movement deltas to the camera.
     * 
     * Uses the same Redux actions as CameraActionsHandler for wall collision.
     * The simplified choreographer only outputs forward, strafe, and rotation
     * (depthPulse and fovPulse are always 1).
     */
    private applyMovement(
        forward: number,
        strafeAmount: number,
        rotation: number,
    ): void {
        if (!this.camera) return;

        // Apply rotation (direct — no wall collision needed)
        if (Math.abs(rotation) > 0.0001) {
            dispatch(rotateCamera(rotation));
        }

        // Apply forward/backward movement with wall collision
        if (Math.abs(forward) > 0.0001) {
            const direction = forward > 0 ? 1 : -1;
            const speed = Math.abs(forward);
            dispatch(moveCamera({
                direction: direction as 1 | -1,
                geometry: this.wallGeometry,
                bspContext: this.bspContext,
                speed,
            }));
        }

        // Apply strafe with wall collision
        if (Math.abs(strafeAmount) > 0.0001) {
            const direction = strafeAmount > 0 ? 1 : -1;
            const speed = Math.abs(strafeAmount);
            dispatch(strafeCamera({
                direction: direction as 1 | -1,
                geometry: this.wallGeometry,
                bspContext: this.bspContext,
                speed,
            }));
        }
    }
}

// ============================================================================
// Wall Proximity Computation (module-level helper)
// ============================================================================

/**
 * Compute the nearest wall distance and the direction pointing away from it.
 * 
 * Scans all solid edges and finds the closest one. The "away" direction is
 * the vector from the closest point on that edge to the camera position,
 * normalized. If the camera is very far from all walls, returns a large
 * distance with a default direction.
 */
function computeWallProximity(position: Vector, solidEdges: IEdge[]): WallProximityInfo {
    let bestDist = Infinity;
    let bestEdge: IEdge | null = null;

    for (const edge of solidEdges) {
        const dist = distanceTo(position, edge.segment);
        if (dist < bestDist) {
            bestDist = dist;
            bestEdge = edge;
        }
    }

    if (bestEdge === null || bestDist > 1000) {
        return { distance: bestDist, awayDirection: [0, 1] };
    }

    // Compute the direction away from the nearest point on the wall
    // projectOn gives the nearest point on the segment
    const nearestPoint = projectOnSegment(position, bestEdge.segment);
    const away = subtract(position, nearestPoint);
    const awayDist = vecDistance(position, nearestPoint);

    if (awayDist < 0.001) {
        // Camera is essentially on the wall — use the edge normal as fallback
        const edgeDir = subtract(bestEdge.segment[1], bestEdge.segment[0]);
        // Perpendicular: rotate 90 degrees
        return { distance: bestDist, awayDirection: normalize([-edgeDir[1], edgeDir[0]]) };
    }

    return { distance: bestDist, awayDirection: normalize(away) };
}

/**
 * Project a point onto a line segment and return the closest point on the segment.
 * Similar to projectOn from lineSegment.ts but returns the point directly.
 */
function projectOnSegment(p: Vector, s: [Vector, Vector]): Vector {
    const v = subtract(s[1], s[0]);
    const u = subtract(p, s[0]);
    const vv = v[0] * v[0] + v[1] * v[1];
    if (vv < 1e-10) return s[0]; // Degenerate segment
    const t = Math.max(0, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / vv));
    return [s[0][0] + t * v[0], s[0][1] + t * v[1]];
}
