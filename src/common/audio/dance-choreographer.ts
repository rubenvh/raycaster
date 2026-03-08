/**
 * Dance choreographer — simplified.
 *
 * Strategy:
 *   1. Follow the A* path closely (face the next waypoint, walk toward it).
 *   2. Rotate the camera left and right in the rhythm of the detected BPM.
 *   3. That's it.
 *
 * The beat detector provides `beatPhase` (0-1, where 0 = on the beat).
 * We derive a sinusoidal rotation offset from that phase so the camera
 * naturally oscillates left/right in time with the music.
 *
 * Movement speed scales with mood intensity so the camera moves faster
 * when the music is louder / more energetic.
 *
 * Stuck detection + re-planning is kept so the camera doesn't get
 * permanently trapped.
 */
import { Vector, distance as vecDistance, subtract, normalize, angleBetween, cross, dot } from '../math/vector';
import { BeatState, DanceMovement, Mood, MoodState, ZERO_MOVEMENT } from './model';
import { NavPath, EMPTY_PATH } from '../navigation/model';

// ============================================================================
// Configuration
// ============================================================================

/** Base forward movement speed (units/sec) — scaled by mood intensity */
const BASE_DRIFT_SPEED = 5.0;

/** Maximum rotation amplitude synced to the beat (radians, ~25 degrees) */
const BEAT_ROTATION_AMPLITUDE = 0.45;

/** How fast the camera turns toward the next waypoint (rad/s) */
const TURN_SPEED = 3.0;

/** How close (units) the camera must be to an intermediate waypoint before
 *  advancing to the next one. Larger radius keeps movement smooth. */
const WAYPOINT_ARRIVAL_RADIUS = 20;

/** How close (units) the camera must be to the final waypoint (destination POI)
 *  before the path is considered complete. Tighter than intermediate to ensure
 *  the camera actually reaches the destination. */
const DESTINATION_ARRIVAL_RADIUS = 20;

// Stuck detection

/** Number of position samples to keep for stuck detection */
const STUCK_HISTORY_SIZE = 60;

/** If the camera moves less than this over the history window, it's stuck */
const STUCK_DISPLACEMENT_THRESHOLD = 8;

/** Minimum time (seconds) before stuck detection activates */
const STUCK_DETECTION_DELAY = 2.0;

/** Cooldown (seconds) between re-plans */
const REPLAN_COOLDOWN = 3.0;

/** Distance from a wall at which frontal-wall re-pathfinding triggers */
const WALL_REPATH_DISTANCE = 10;

/** Cooldown (seconds) between wall-proximity re-pathfinds */
const WALL_REPATH_COOLDOWN = 1.0;

// Speed multipliers per mood (Silent is slowest, Drop is fastest)
const MOOD_SPEED: Record<Mood, number> = {
    [Mood.Silent]: 0.3,
    [Mood.Calm]: 0.6,
    [Mood.Buildup]: 0.8,
    [Mood.Drop]: 1.0,
    [Mood.Groove]: 0.9,
};

// Rotation amplitude multiplier per mood
const MOOD_ROTATION: Record<Mood, number> = {
    [Mood.Silent]: 0.2,
    [Mood.Calm]: 0.5,
    [Mood.Buildup]: 0.7,
    [Mood.Drop]: 1.0,
    [Mood.Groove]: 0.8,
};

// ============================================================================
// Exports
// ============================================================================

/** Information about the nearest wall relative to a position */
export type WallProximityInfo = {
    distance: number;
    awayDirection: Vector;
};

// ============================================================================
// Dance Choreographer
// ============================================================================

export class DanceChoreographer {
    // Path + tour
    private path: NavPath = EMPTY_PATH;
    private waypointIndex = 0;
    private tour: Vector[] = [];
    private tourIndex = 0;

    // Camera state (updated externally each frame)
    private cameraPosition: Vector = [0, 0];
    private cameraDirection: Vector = [0, 1];

    // Time
    private time = 0;

    // Fallback rotation phase when no BPM is detected
    private fallbackPhase = 0;

    // Pathfinder callback
    private pathfinder: ((from: Vector, to: Vector) => NavPath) | null = null;

    // Wall proximity callback (kept for potential future use, not used for movement)
    private wallProximity: ((position: Vector) => WallProximityInfo) | null = null;

    // Stuck detection
    private positionHistory: Vector[] = [];
    private positionHistoryIndex = 0;
    private positionHistoryFull = false;
    private isStuck = false;
    private lastReplanTime = -Infinity;
    private lastWallRepathTime = -Infinity;

    // ========================================================================
    // Public API
    // ========================================================================

    setPathfinder(fn: (from: Vector, to: Vector) => NavPath): void {
        this.pathfinder = fn;
    }

    setWallProximity(fn: (position: Vector) => WallProximityInfo): void {
        this.wallProximity = fn;
    }

    setTour(tour: Vector[]): void {
        this.tour = tour;
        this.tourIndex = 0;
        this.requestNextPath();
    }

    updateCameraState(position: Vector, direction: Vector): void {
        this.cameraPosition = position;
        this.cameraDirection = normalize(direction);
    }

    getIsStuck(): boolean {
        return this.isStuck;
    }

    getCurrentPath(): Vector[] {
        return this.path.waypoints;
    }

    getCurrentWaypointIndex(): number {
        return this.waypointIndex;
    }

    // ========================================================================
    // Main per-frame update
    // ========================================================================

    process(mood: MoodState, beat: BeatState, deltaTime: number): DanceMovement {
        this.time += deltaTime;

        // Stuck detection bookkeeping
        this.recordPosition(this.cameraPosition);
        this.detectStuck();

        // 1. Path following: turn toward waypoint, move forward
        const pathMovement = this.processPathFollowing(mood, deltaTime);

        // 2. Beat-synced rotation oscillation
        const beatRotation = this.processBeatRotation(mood, beat, deltaTime);

        // 3. Wall-frontal re-pathfinding: if the camera is close to a wall
        // and facing toward it, re-pathfind to the same destination immediately
        // instead of waiting for the slow stuck detection timer.
        if (this.shouldRepathFromWall()) {
            this.handleWallRepath();
        }

        // 4. Stuck re-plan (only when stuck)
        if (this.isStuck && (this.time - this.lastReplanTime) > REPLAN_COOLDOWN) {
            this.handleStuckReplan();
        }

        // Combine: path following drives forward + turn-toward-waypoint rotation,
        // beat drives an additive left-right rotation oscillation.
        return {
            forward: pathMovement.forward * deltaTime,
            strafe: 0,
            rotation: (pathMovement.rotation + beatRotation) * deltaTime,
            depthPulse: 1,
            fovPulse: 1,
        };
    }

    // ========================================================================
    // Path Following
    // ========================================================================

    private processPathFollowing(mood: MoodState, dt: number): { forward: number; rotation: number } {
        const speedMul = MOOD_SPEED[mood.current] * mood.intensity;

        if (this.path.waypoints.length === 0 || this.waypointIndex >= this.path.waypoints.length) {
            // No path — gentle forward drift
            return { forward: BASE_DRIFT_SPEED * 0.2 * speedMul, rotation: 0 };
        }

        const target = this.path.waypoints[this.waypointIndex];
        const dist = vecDistance(this.cameraPosition, target);

        if (dist < 1) {
            this.checkWaypointArrival();
            return { forward: 0, rotation: 0 };
        }

        // Turn toward waypoint
        const desiredDir = normalize(subtract(target, this.cameraPosition));
        const angle = angleBetween(this.cameraDirection, desiredDir);
        const crossVal = cross(this.cameraDirection, desiredDir);
        const turnSign = crossVal >= 0 ? 1 : -1;

        // Increase turn speed when stuck
        const stuckMul = this.isStuck ? 4.0 : 1.0;
        const rotation = Math.min(Math.abs(angle), TURN_SPEED * stuckMul) * turnSign;

        // Forward speed proportional to how well we face the target
        // cos(0)=1 (facing target), cos(PI)=-1 (facing away)
        const facingFactor = Math.max(0, (1 + Math.cos(angle)) / 2);
        const forward = BASE_DRIFT_SPEED * speedMul * facingFactor;

        this.checkWaypointArrival();

        return { forward, rotation };
    }

    // ========================================================================
    // Beat-synced rotation
    // ========================================================================

    /**
     * Produce a sinusoidal rotation offset synced to the beat phase.
     * When BPM is known, we use beatPhase directly (0-1 per beat cycle).
     * When BPM is unknown, we use a slow fallback oscillation.
     */
    private processBeatRotation(mood: MoodState, beat: BeatState, dt: number): number {
        const amplitude = BEAT_ROTATION_AMPLITUDE * MOOD_ROTATION[mood.current] * mood.intensity;

        if (beat.bpm > 0 && beat.bpmConfidence > 0.2) {
            // Beat-synced: sin wave over the beat phase (one full cycle per beat)
            return Math.sin(beat.beatPhase * Math.PI * 2) * amplitude;
        }

        // Fallback: slow oscillation (~0.3 Hz)
        this.fallbackPhase += 0.3 * dt * Math.PI * 2;
        return Math.sin(this.fallbackPhase) * amplitude * 0.3;
    }

    // ========================================================================
    // Waypoint Arrival
    // ========================================================================

    private checkWaypointArrival(): void {
        if (this.path.waypoints.length === 0 || this.waypointIndex >= this.path.waypoints.length) {
            return;
        }

        const target = this.path.waypoints[this.waypointIndex];
        const dist = vecDistance(this.cameraPosition, target);
        const isLastWaypoint = this.waypointIndex >= this.path.waypoints.length - 1;

        // Use tighter radius for the final waypoint (destination POI) to ensure
        // the camera actually reaches the destination before moving on.
        const arrivalRadius = isLastWaypoint ? DESTINATION_ARRIVAL_RADIUS : WAYPOINT_ARRIVAL_RADIUS;

        if (dist < arrivalRadius) {
            this.waypointIndex++;
            if (this.waypointIndex >= this.path.waypoints.length) {
                // Path complete — advance to the next tour destination
                this.advanceTour();
                this.requestNextPath();
            }
        }
    }

    // ========================================================================
    // Stuck Detection
    // ========================================================================

    private recordPosition(position: Vector): void {
        const entry: Vector = [position[0], position[1]];
        if (this.positionHistory.length < STUCK_HISTORY_SIZE) {
            this.positionHistory.push(entry);
        } else {
            this.positionHistory[this.positionHistoryIndex] = entry;
            this.positionHistoryFull = true;
        }
        this.positionHistoryIndex = (this.positionHistoryIndex + 1) % STUCK_HISTORY_SIZE;
    }

    private detectStuck(): void {
        if (this.time < STUCK_DETECTION_DELAY || !this.positionHistoryFull) {
            this.isStuck = false;
            return;
        }
        const oldestIndex = this.positionHistoryIndex;
        const oldest = this.positionHistory[oldestIndex];
        const displacement = vecDistance(oldest, this.cameraPosition);
        this.isStuck = displacement < STUCK_DISPLACEMENT_THRESHOLD;
    }

    private handleStuckReplan(): void {
        this.lastReplanTime = this.time;
        if (this.tour.length === 0 || !this.pathfinder) return;

        const skipCount = Math.min(2, Math.max(1, Math.floor(this.tour.length / 4)));
        for (let i = 0; i < skipCount; i++) {
            this.advanceTour();
        }
        this.requestNextPath();
    }

    // ========================================================================
    // Wall-Frontal Re-pathfinding
    // ========================================================================

    /**
     * Detects whether the camera is close to a wall and facing toward it.
     * When this happens, the camera's move() will wall-slide or stop,
     * making the choreographer's path unachievable from the current heading.
     * Re-pathfinding from the current position finds a way around the wall.
     */
    private shouldRepathFromWall(): boolean {
        if (!this.wallProximity || !this.pathfinder) return false;
        if (this.path.waypoints.length === 0) return false;
        if ((this.time - this.lastWallRepathTime) < WALL_REPATH_COOLDOWN) return false;

        const info = this.wallProximity(this.cameraPosition);
        if (info.distance > WALL_REPATH_DISTANCE) return false;

        // Check if camera is facing toward the wall.
        // awayDirection points from wall to camera, so dot(cameraDirection, awayDirection) < 0
        // means the camera is facing toward the wall.
        const facingWall = dot(this.cameraDirection, info.awayDirection);
        return facingWall < -0.3; // roughly > ~70° toward the wall
    }

    private handleWallRepath(): void {
        if (!this.pathfinder || this.tour.length === 0) return;

        this.lastWallRepathTime = this.time;

        // Re-pathfind to the SAME destination (don't skip tour stops)
        const destination = this.tour[this.tourIndex];
        const newPath = this.pathfinder(this.cameraPosition, destination);
        if (newPath.waypoints.length > 0) {
            this.path = newPath;
            this.waypointIndex = 0;
            // Don't reset stuck detection here — the camera might still be
            // stuck if the new path also leads into the wall.
        }
    }

    // ========================================================================
    // Tour Management
    // ========================================================================

    private advanceTour(): void {
        if (this.tour.length === 0) return;
        this.tourIndex = (this.tourIndex + 1) % this.tour.length;
    }

    private requestNextPath(): void {
        if (this.tour.length === 0 || !this.pathfinder) return;
        const destination = this.tour[this.tourIndex];
        const newPath = this.pathfinder(this.cameraPosition, destination);
        if (newPath.waypoints.length > 0) {
            this.path = newPath;
            this.waypointIndex = 0;
            this.resetStuckDetection();
        }
    }

    /** Reset stuck detection state when starting a new path. This prevents
     *  stale position history from the previous path from causing an
     *  immediate false stuck detection on the new path. */
    private resetStuckDetection(): void {
        this.positionHistory = [];
        this.positionHistoryIndex = 0;
        this.positionHistoryFull = false;
        this.isStuck = false;
    }
}
