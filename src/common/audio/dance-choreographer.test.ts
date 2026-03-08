import { DanceChoreographer } from './dance-choreographer';
import { BeatState, BeatType, EMPTY_BEAT_STATE, Mood, MoodState, INITIAL_MOOD_STATE } from './model';
import { NavPath } from '../navigation/model';
import { Vector } from '../math/vector';

describe('DanceChoreographer', () => {
    let choreographer: DanceChoreographer;

    beforeEach(() => {
        choreographer = new DanceChoreographer();
        choreographer.updateCameraState([100, 100], [0, 1]);
    });

    function makeMood(overrides: Partial<MoodState> = {}): MoodState {
        return {
            ...INITIAL_MOOD_STATE,
            current: Mood.Calm,
            intensity: 0.5,
            duration: 5000,
            ...overrides,
        };
    }

    function makeBeat(overrides: Partial<BeatState> = {}): BeatState {
        return {
            ...EMPTY_BEAT_STATE,
            ...overrides,
        };
    }

    /** Simulate N frames of processing without moving the camera position */
    function simulateFrames(n: number, mood?: MoodState, beat?: BeatState, dt = 1 / 60) {
        const m = mood ?? makeMood();
        const b = beat ?? makeBeat();
        for (let i = 0; i < n; i++) {
            choreographer.process(m, b, dt);
        }
    }

    // ========================================================================
    // Basic output shape
    // ========================================================================

    describe('basic output', () => {
        it('should produce movement with correct structure', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();
            const movement = choreographer.process(mood, beat, 1 / 60);

            expect(movement).toBeDefined();
            expect(typeof movement.forward).toBe('number');
            expect(typeof movement.strafe).toBe('number');
            expect(typeof movement.rotation).toBe('number');
            expect(typeof movement.depthPulse).toBe('number');
            expect(typeof movement.fovPulse).toBe('number');
        });

        it('should always return strafe = 0', () => {
            const mood = makeMood({ current: Mood.Drop, intensity: 1.0 });
            const beat = makeBeat({ isBeat: true, beatType: BeatType.Snare, beatStrength: 1.0 });

            for (let i = 0; i < 30; i++) {
                const movement = choreographer.process(mood, beat, 1 / 60);
                expect(movement.strafe).toBe(0);
            }
        });

        it('should always return depthPulse = 1 and fovPulse = 1', () => {
            const mood = makeMood({ current: Mood.Drop, intensity: 1.0 });
            const beat = makeBeat({ isBeat: true, beatType: BeatType.Kick, beatStrength: 1.0 });

            for (let i = 0; i < 30; i++) {
                const movement = choreographer.process(mood, beat, 1 / 60);
                expect(movement.depthPulse).toBe(1);
                expect(movement.fovPulse).toBe(1);
            }
        });

        it('should produce some forward drift even without a path', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();
            const movement = choreographer.process(mood, beat, 1 / 60);

            // No path → gentle forward drift
            expect(movement.forward).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Mood scaling
    // ========================================================================

    describe('mood scaling', () => {
        it('should produce near-zero forward movement in SILENT mood with zero intensity', () => {
            const mood = makeMood({ current: Mood.Silent, intensity: 0 });
            const beat = makeBeat();
            const movement = choreographer.process(mood, beat, 1 / 60);

            // Silent × 0 intensity = near zero
            expect(Math.abs(movement.forward)).toBeLessThan(0.001);
        });

        it('should produce larger forward movement in DROP mood than SILENT', () => {
            const silentMood = makeMood({ current: Mood.Silent, intensity: 0.5 });
            const dropMood = makeMood({ current: Mood.Drop, intensity: 0.8 });
            const beat = makeBeat();

            const silentMovement = choreographer.process(silentMood, beat, 1 / 60);

            // Reset for fair comparison
            choreographer = new DanceChoreographer();
            choreographer.updateCameraState([100, 100], [0, 1]);

            const dropMovement = choreographer.process(dropMood, beat, 1 / 60);

            expect(Math.abs(dropMovement.forward)).toBeGreaterThan(Math.abs(silentMovement.forward));
        });

        it('should scale beat rotation amplitude with mood intensity', () => {
            const beat = makeBeat({ bpm: 120, bpmConfidence: 0.8, beatPhase: 0.25 });

            // High intensity
            const highMood = makeMood({ current: Mood.Drop, intensity: 1.0 });
            const highMovement = choreographer.process(highMood, beat, 1 / 60);

            // Reset
            choreographer = new DanceChoreographer();
            choreographer.updateCameraState([100, 100], [0, 1]);

            // Low intensity
            const lowMood = makeMood({ current: Mood.Silent, intensity: 0.2 });
            const lowMovement = choreographer.process(lowMood, beat, 1 / 60);

            // High intensity + Drop mood should produce larger rotation than low intensity + Silent
            expect(Math.abs(highMovement.rotation)).toBeGreaterThan(Math.abs(lowMovement.rotation));
        });
    });

    // ========================================================================
    // Path following
    // ========================================================================

    describe('path following', () => {
        it('should follow tour waypoints', () => {
            const tour: Vector[] = [[200, 200], [300, 300], [400, 200]];
            choreographer.setTour(tour);

            choreographer.setPathfinder((from, to) => ({
                waypoints: [from, to],
                totalLength: 100,
                nodeIds: [0, 1],
            }));

            choreographer.updateCameraState([100, 100], [0, 1]);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            const movement = choreographer.process(mood, beat, 1 / 60);

            // Should have rotation toward waypoint and some forward
            expect(movement).toBeDefined();
            expect(typeof movement.rotation).toBe('number');
        });

        it('should turn toward the next waypoint', () => {
            // Waypoint is directly to the right (+x)
            const tour: Vector[] = [[300, 100]];
            choreographer.setPathfinder((from, to) => ({
                waypoints: [to],
                totalLength: 200,
                nodeIds: [0],
            }));
            choreographer.setTour(tour);

            // Camera at [100, 100] facing up [0, 1]
            // Waypoint at [300, 100] is to the right — need to turn clockwise
            choreographer.updateCameraState([100, 100], [0, 1]);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat(); // No BPM so beat rotation is minimal

            const movement = choreographer.process(mood, beat, 1 / 60);

            // The path-following rotation should be nonzero (turning toward waypoint)
            // Beat rotation without BPM is very small, so total rotation is dominated by path
            expect(Math.abs(movement.rotation)).toBeGreaterThan(0.0001);
        });

        it('should reduce forward speed when not facing the waypoint', () => {
            const tour: Vector[] = [[300, 100]];
            choreographer.setPathfinder((from, to) => ({
                waypoints: [to],
                totalLength: 200,
                nodeIds: [0],
            }));
            choreographer.setTour(tour);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Camera facing toward waypoint [1, 0]
            choreographer.updateCameraState([100, 100], [1, 0]);
            const facingMovement = choreographer.process(mood, beat, 1 / 60);

            // Reset
            choreographer = new DanceChoreographer();
            choreographer.setPathfinder((from, to) => ({
                waypoints: [to],
                totalLength: 200,
                nodeIds: [0],
            }));
            choreographer.setTour(tour);

            // Camera facing away from waypoint [-1, 0]
            choreographer.updateCameraState([100, 100], [-1, 0]);
            const awayMovement = choreographer.process(mood, beat, 1 / 60);

            // Facing toward should produce more forward than facing away
            expect(facingMovement.forward).toBeGreaterThan(awayMovement.forward);
        });

        it('should drift forward even without a tour', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            const movement = choreographer.process(mood, beat, 1 / 60);
            expect(movement.forward).toBeGreaterThan(0);
        });

        it('should advance waypoints when arriving close to one', () => {
            const tour: Vector[] = [[140, 100], [300, 300]];
            let pathfinderCalls = 0;

            choreographer.setPathfinder((from, to) => {
                pathfinderCalls++;
                return {
                    waypoints: [to],
                    totalLength: 100,
                    nodeIds: [0],
                };
            });
            choreographer.setTour(tour);
            const initialCalls = pathfinderCalls;

            // Place camera within arrival radius of the first waypoint
            choreographer.updateCameraState([130, 100], [1, 0]);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();
            choreographer.process(mood, beat, 1 / 60);

            // Should have advanced to next tour stop (triggering a pathfinder call)
            expect(pathfinderCalls).toBeGreaterThan(initialCalls);
        });

        it('should use tighter arrival radius for the final waypoint (destination)', () => {
            // Path with two waypoints: an intermediate one and a final destination.
            // The intermediate waypoint arrival radius is 40.
            // The destination arrival radius is 20.
            // Place camera at distance 25 from the waypoint — should arrive at
            // intermediate but NOT at the destination.
            const tour: Vector[] = [[200, 100]];
            let pathfinderCalls = 0;

            choreographer.setPathfinder((from, to) => {
                pathfinderCalls++;
                return {
                    // Two waypoints: intermediate at [150, 100], final at [200, 100]
                    waypoints: [[150, 100], [200, 100]],
                    totalLength: 100,
                    nodeIds: [0, 1],
                };
            });
            choreographer.setTour(tour);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Camera at distance 25 from intermediate waypoint [150, 100]
            // 25 < 40 (WAYPOINT_ARRIVAL_RADIUS) → should advance past intermediate
            choreographer.updateCameraState([125, 100], [1, 0]);
            choreographer.process(mood, beat, 1 / 60);

            // After advancing past intermediate, the current waypoint should be
            // the final one at [200, 100]. The camera is at ~[125,100], which is
            // 75 units from [200,100] — well outside DESTINATION_ARRIVAL_RADIUS=20.
            // So we should still be on this path (no re-plan to next tour stop).
            const callsAfterAdvance = pathfinderCalls;

            // Process again — should NOT have triggered a new pathfinder call
            // because we haven't reached the final destination yet
            choreographer.process(mood, beat, 1 / 60);
            expect(pathfinderCalls).toBe(callsAfterAdvance);
        });

        it('should complete path when camera reaches final destination within tight radius', () => {
            const tour: Vector[] = [[200, 100], [400, 200]];
            let pathfinderCalls = 0;
            const destinations: Vector[] = [];

            choreographer.setPathfinder((from, to) => {
                pathfinderCalls++;
                destinations.push(to);
                return {
                    waypoints: [to],
                    totalLength: 100,
                    nodeIds: [0],
                };
            });
            choreographer.setTour(tour);
            const callsAfterSetTour = pathfinderCalls;

            // Place camera within DESTINATION_ARRIVAL_RADIUS (20) of the destination
            choreographer.updateCameraState([185, 100], [1, 0]);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();
            choreographer.process(mood, beat, 1 / 60);

            // Should have completed the path and requested the next tour destination
            expect(pathfinderCalls).toBeGreaterThan(callsAfterSetTour);
            // The new destination should be tour[1] (the next tour stop)
            expect(destinations[destinations.length - 1]).toEqual(tour[1]);
        });
    });

    // ========================================================================
    // Beat-synced rotation
    // ========================================================================

    describe('beat-synced rotation', () => {
        it('should produce oscillating rotation when BPM is known', () => {
            const mood = makeMood({ current: Mood.Groove, intensity: 0.8 });

            // Collect rotation values at different beat phases
            const rotations: number[] = [];
            for (let i = 0; i < 20; i++) {
                const phase = i / 20; // 0 to 0.95
                const beat = makeBeat({ bpm: 120, bpmConfidence: 0.8, beatPhase: phase });
                const movement = choreographer.process(mood, beat, 1 / 60);
                rotations.push(movement.rotation);
            }

            // Should have both positive and negative rotation values
            const hasPositive = rotations.some(v => v > 0.0001);
            const hasNegative = rotations.some(v => v < -0.0001);
            expect(hasPositive).toBe(true);
            expect(hasNegative).toBe(true);
        });

        it('should produce larger rotation at beat phase 0.25 than at phase 0', () => {
            const mood = makeMood({ current: Mood.Groove, intensity: 0.8 });

            // sin(0) = 0, sin(0.25 * 2π) = sin(π/2) = 1
            // At phase 0.25 the beat rotation is at maximum amplitude
            const beatAt0 = makeBeat({ bpm: 120, bpmConfidence: 0.8, beatPhase: 0 });
            const beatAt025 = makeBeat({ bpm: 120, bpmConfidence: 0.8, beatPhase: 0.25 });

            // Process with no path so path-following rotation is ~0
            const mov0 = choreographer.process(mood, beatAt0, 1 / 60);

            choreographer = new DanceChoreographer();
            choreographer.updateCameraState([100, 100], [0, 1]);

            const mov025 = choreographer.process(mood, beatAt025, 1 / 60);

            // Beat rotation at phase 0.25 should be larger in magnitude
            expect(Math.abs(mov025.rotation)).toBeGreaterThan(Math.abs(mov0.rotation));
        });

        it('should use fallback oscillation when BPM is unknown', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat({ bpm: 0, bpmConfidence: 0 }); // No BPM detected

            // Collect rotation values over time
            const rotations: number[] = [];
            for (let i = 0; i < 120; i++) {
                const movement = choreographer.process(mood, beat, 1 / 60);
                rotations.push(movement.rotation);
            }

            // Fallback oscillation is slower and has reduced amplitude (×0.3)
            // but should still produce some nonzero rotation
            const maxAbs = Math.max(...rotations.map(Math.abs));
            expect(maxAbs).toBeGreaterThan(0);
        });

        it('should not use beat-synced rotation when bpmConfidence is very low', () => {
            const mood = makeMood({ current: Mood.Groove, intensity: 0.8 });

            // Low confidence — should fall back to slow oscillation
            const beat = makeBeat({ bpm: 120, bpmConfidence: 0.1, beatPhase: 0.25 });

            const movement = choreographer.process(mood, beat, 1 / 60);

            // With low confidence, the fallback oscillation starts near zero on first frame
            // (fallbackPhase starts at 0). So rotation should be small.
            // With high confidence at phase 0.25, sin(π/2) = 1 → large rotation.
            // Check that we're using fallback (small) rather than beat-synced (large).
            expect(Math.abs(movement.rotation)).toBeLessThan(0.1);
        });
    });

    // ========================================================================
    // Stuck detection
    // ========================================================================

    describe('stuck detection', () => {
        it('should not be stuck initially', () => {
            expect(choreographer.getIsStuck()).toBe(false);
        });

        it('should not be stuck before detection delay', () => {
            // 60 frames × 1/60 = 1 second — still under 2s delay
            simulateFrames(60);
            expect(choreographer.getIsStuck()).toBe(false);
        });

        it('should detect stuck when camera position does not change', () => {
            // Need to fill history buffer (60 entries) AND pass delay (2s)
            // 150 frames × 1/60 = 2.5s — exceeds delay
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();
            for (let i = 0; i < 150; i++) {
                choreographer.process(mood, beat, 1 / 60);
                // Don't update camera position — stays at [100, 100]
            }
            expect(choreographer.getIsStuck()).toBe(true);
        });

        it('should not be stuck when camera moves steadily', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();
            for (let i = 0; i < 150; i++) {
                choreographer.updateCameraState([100 + i * 0.5, 100], [1, 0]);
                choreographer.process(mood, beat, 1 / 60);
            }
            expect(choreographer.getIsStuck()).toBe(false);
        });

        it('should clear stuck state when camera starts moving again', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Phase 1: Get stuck
            for (let i = 0; i < 150; i++) {
                choreographer.process(mood, beat, 1 / 60);
            }
            expect(choreographer.getIsStuck()).toBe(true);

            // Phase 2: Start moving
            for (let i = 0; i < 80; i++) {
                choreographer.updateCameraState([100 + i * 2, 100], [1, 0]);
                choreographer.process(mood, beat, 1 / 60);
            }
            expect(choreographer.getIsStuck()).toBe(false);
        });

        it('should reset stuck detection when a new path is started', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Phase 1: Get stuck (fills position history + exceeds delay)
            for (let i = 0; i < 150; i++) {
                choreographer.process(mood, beat, 1 / 60);
            }
            expect(choreographer.getIsStuck()).toBe(true);

            // Phase 2: Set up a pathfinder and start a new tour.
            // requestNextPath() should reset stuck detection, so isStuck
            // should be false immediately even though the camera hasn't moved.
            choreographer.setPathfinder((from, to) => ({
                waypoints: [to],
                totalLength: 100,
                nodeIds: [0],
            }));
            choreographer.setTour([[500, 500]]);

            // After setTour → requestNextPath → resetStuckDetection,
            // stuck should be cleared
            expect(choreographer.getIsStuck()).toBe(false);
        });

        it('should increase turn speed when stuck', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat(); // No BPM

            // Set up a path with waypoint to the right.
            // Camera facing up [0,1], waypoint at [300,100] — needs to turn.
            const tour: Vector[] = [[300, 100]];
            choreographer.setPathfinder((from, to) => ({
                waypoints: [to],
                totalLength: 200,
                nodeIds: [0],
            }));
            choreographer.setTour(tour);
            choreographer.updateCameraState([100, 100], [0, 1]);

            // Get a movement when NOT stuck
            const notStuckMovement = choreographer.process(mood, beat, 1 / 60);

            // Get stuck: simulate frames without moving the camera.
            // After the first replan fires (immediately on stuck detection since
            // lastReplanTime starts at -Infinity), stuck detection resets.
            // We need enough frames after the reset to fill the history buffer
            // again AND exceed the detection delay, AND exceed the replan cooldown
            // so that stuck persists at the moment we check.
            // History: 60 frames to fill. Delay: 2s = 120 frames at 1/60.
            // Replan cooldown: 3s = 180 frames. After the first replan resets
            // stuck, we need 120+ more frames to get stuck again, plus the replan
            // cooldown must have elapsed (3s). Total ~300 frames should suffice.
            for (let i = 1; i < 400; i++) {
                choreographer.process(mood, beat, 1 / 60);
            }
            expect(choreographer.getIsStuck()).toBe(true);

            // Get a movement when stuck
            const stuckMovement = choreographer.process(mood, beat, 1 / 60);

            // Stuck turn speed multiplier is 4.0, so rotation should be larger
            expect(Math.abs(stuckMovement.rotation)).toBeGreaterThan(Math.abs(notStuckMovement.rotation));
        });
    });

    // ========================================================================
    // Path re-planning on stuck
    // ========================================================================

    describe('path re-planning on stuck', () => {
        it('should request a new path when stuck is detected', () => {
            const tour: Vector[] = [[200, 200], [300, 300], [400, 200], [500, 100]];
            let pathfinderCalls = 0;

            choreographer.setPathfinder((from, to) => {
                pathfinderCalls++;
                return {
                    waypoints: [from, to],
                    totalLength: 100,
                    nodeIds: [0, 1],
                };
            });
            choreographer.setTour(tour);

            const initialCalls = pathfinderCalls;

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Get stuck and trigger re-plan (exceeds delay + cooldown)
            for (let i = 0; i < 250; i++) {
                choreographer.process(mood, beat, 1 / 60);
            }

            expect(pathfinderCalls).toBeGreaterThan(initialCalls);
        });

        it('should skip tour stops when re-planning from stuck', () => {
            const tour: Vector[] = [[200, 200], [300, 300], [400, 200], [500, 100]];
            const destinations: Vector[] = [];

            choreographer.setPathfinder((from, to) => {
                destinations.push(to);
                return {
                    waypoints: [from, to],
                    totalLength: 100,
                    nodeIds: [0, 1],
                };
            });
            choreographer.setTour(tour);

            // First destination should be tour[0]
            expect(destinations[0]).toEqual(tour[0]);

            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Get stuck and trigger re-plan
            for (let i = 0; i < 250; i++) {
                choreographer.process(mood, beat, 1 / 60);
            }

            // Re-plan should have skipped ahead — the latest destination should NOT
            // be tour[0] (the stuck target)
            const lastDest = destinations[destinations.length - 1];
            expect(lastDest).not.toEqual(tour[0]);
        });
    });

    // ========================================================================
    // Wall proximity callback (retained for compatibility)
    // ========================================================================

    describe('wall proximity callback', () => {
        it('should accept wall proximity callback without error', () => {
            // The simplified choreographer accepts but doesn't use wall proximity
            expect(() => {
                choreographer.setWallProximity(() => ({
                    distance: 5,
                    awayDirection: [1, 0],
                }));
            }).not.toThrow();
        });

        it('should not affect movement output regardless of wall proximity', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            // Without wall proximity
            const movNoWall = choreographer.process(mood, beat, 1 / 60);

            // Reset and add wall proximity
            choreographer = new DanceChoreographer();
            choreographer.updateCameraState([100, 100], [0, 1]);
            choreographer.setWallProximity(() => ({
                distance: 2,
                awayDirection: [1, 0],
            }));
            const movWithWall = choreographer.process(mood, beat, 1 / 60);

            // Movement should be identical (wall proximity not used)
            expect(movWithWall.forward).toBeCloseTo(movNoWall.forward, 10);
            expect(movWithWall.strafe).toBe(movNoWall.strafe);
            expect(movWithWall.depthPulse).toBe(movNoWall.depthPulse);
            expect(movWithWall.fovPulse).toBe(movNoWall.fovPulse);
        });
    });

    // ========================================================================
    // DanceMovement is scaled by deltaTime
    // ========================================================================

    describe('deltaTime scaling', () => {
        it('should scale forward and rotation with deltaTime', () => {
            const mood = makeMood({ current: Mood.Calm, intensity: 0.5 });
            const beat = makeBeat();

            const movSmall = choreographer.process(mood, beat, 1 / 60);

            // Reset
            choreographer = new DanceChoreographer();
            choreographer.updateCameraState([100, 100], [0, 1]);

            const movLarge = choreographer.process(mood, beat, 2 / 60);

            // Doubling deltaTime should roughly double forward and rotation
            // (not exact because of internal state changes, but should be proportional)
            expect(Math.abs(movLarge.forward)).toBeGreaterThan(Math.abs(movSmall.forward) * 1.5);
        });
    });
});
