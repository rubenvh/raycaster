import { MoodMachine } from './mood-machine';
import { AudioFeatures, EMPTY_AUDIO_FEATURES, BeatState, BeatType, EMPTY_BEAT_STATE, Mood } from './model';

describe('MoodMachine', () => {
    let machine: MoodMachine;

    beforeEach(() => {
        machine = new MoodMachine();
    });

    function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
        return {
            ...EMPTY_AUDIO_FEATURES,
            timestamp: performance.now(),
            ...overrides,
        };
    }

    function makeBeat(overrides: Partial<BeatState> = {}): BeatState {
        return {
            ...EMPTY_BEAT_STATE,
            timestamp: performance.now(),
            ...overrides,
        };
    }

    /** Advance the machine by N frames with given features */
    function advanceFrames(
        n: number,
        features: Partial<AudioFeatures> = {},
        beat: Partial<BeatState> = {},
        dtMs: number = 23,
    ): void {
        for (let i = 0; i < n; i++) {
            machine.process(makeFeatures(features), makeBeat(beat), dtMs);
        }
    }

    // ========================================================================
    // Initial state
    // ========================================================================

    describe('initial state', () => {
        it('should start in SILENT mood', () => {
            expect(machine.current.current).toBe(Mood.Silent);
        });

        it('should have zero intensity initially', () => {
            expect(machine.current.intensity).toBe(0);
        });
    });

    // ========================================================================
    // Transitions from SILENT
    // ========================================================================

    describe('transitions from SILENT', () => {
        it('should transition to CALM when audio is detected', () => {
            // First, stay in silent long enough to meet min duration
            advanceFrames(100, { rms: 0, isActive: false }, {}, 23);

            // Now provide audio above silence threshold but below buildup range
            advanceFrames(20, { rms: 0.02, isActive: true, spectralFlux: 0.001 });

            expect(machine.current.current).toBe(Mood.Calm);
        });

        it('should stay SILENT when no audio is present', () => {
            advanceFrames(100, { rms: 0, isActive: false });
            expect(machine.current.current).toBe(Mood.Silent);
        });
    });

    // ========================================================================
    // Transitions from CALM
    // ========================================================================

    describe('transitions from CALM', () => {
        beforeEach(() => {
            // Get into CALM state: silence first, then gentle audio
            advanceFrames(100, { rms: 0, isActive: false }, {}, 23);
            advanceFrames(20, { rms: 0.02, isActive: true, spectralFlux: 0.001 });
            expect(machine.current.current).toBe(Mood.Calm);
        });

        it('should transition to DROP on sustained loud audio', () => {
            // Stay calm long enough (low rms, minimal flux — below buildup threshold)
            advanceFrames(100, { rms: 0.02, isActive: true, spectralFlux: 0.001 }, {}, 23);
            // Now sustained loud with high flux
            advanceFrames(50, { rms: 0.2, isActive: true, spectralFlux: 0.1 }, {}, 23);

            expect(machine.current.current).toBe(Mood.Drop);
        });

        it('should transition back to SILENT on sustained silence', () => {
            advanceFrames(100, { rms: 0.02, isActive: true }, {}, 23);
            advanceFrames(50, { rms: 0, isActive: false }, {}, 23);

            expect(machine.current.current).toBe(Mood.Silent);
        });

        it('should transition to GROOVE with steady beat', () => {
            // Stay calm long enough (low rms, no flux — avoid buildup)
            advanceFrames(100, { rms: 0.02, isActive: true, spectralFlux: 0.001 }, {}, 23);
            // Steady beat with high confidence
            advanceFrames(50,
                { rms: 0.02, isActive: true, spectralFlux: 0.001 },
                { bpmConfidence: 0.8, bpm: 120 },
                23,
            );

            expect(machine.current.current).toBe(Mood.Groove);
        });
    });

    // ========================================================================
    // Intensity ramping
    // ========================================================================

    describe('intensity', () => {
        it('should ramp up intensity over time within a mood', () => {
            const state1 = machine.process(makeFeatures(), makeBeat(), 100);
            const state2 = machine.process(makeFeatures(), makeBeat(), 1000);
            const state3 = machine.process(makeFeatures(), makeBeat(), 2000);

            expect(state2.intensity).toBeGreaterThan(state1.intensity);
            expect(state3.intensity).toBeGreaterThan(state2.intensity);
        });

        it('should cap intensity at 1.0', () => {
            // Advance many frames to exceed 3 seconds
            advanceFrames(200, {}, {}, 100);
            expect(machine.current.intensity).toBeLessThanOrEqual(1);
        });
    });

    // ========================================================================
    // Reset
    // ========================================================================

    describe('reset', () => {
        it('should return to initial state', () => {
            // Get into some non-initial state
            advanceFrames(100, { rms: 0 }, {}, 23);
            advanceFrames(20, { rms: 0.02, isActive: true, spectralFlux: 0.001 });

            machine.reset();
            expect(machine.current.current).toBe(Mood.Silent);
            expect(machine.current.intensity).toBe(0);
            expect(machine.current.duration).toBe(0);
        });
    });

    // ========================================================================
    // Smoothed metrics prevent jitter
    // ========================================================================

    describe('stability', () => {
        it('should not jitter between moods on brief audio changes', () => {
            // Get into CALM
            advanceFrames(100, { rms: 0 }, {}, 23);
            advanceFrames(20, { rms: 0.02, isActive: true, spectralFlux: 0.001 });
            expect(machine.current.current).toBe(Mood.Calm);

            // Brief loud spike — should NOT immediately jump to DROP
            advanceFrames(2, { rms: 0.3, isActive: true, spectralFlux: 0.2 });
            expect(machine.current.current).toBe(Mood.Calm);
        });
    });
});
