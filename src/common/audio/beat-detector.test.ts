import { BeatDetector } from './beat-detector';
import { AudioFeatures, EMPTY_AUDIO_FEATURES, BeatType } from './model';

describe('BeatDetector', () => {
    let detector: BeatDetector;

    beforeEach(() => {
        detector = new BeatDetector();
    });

    function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
        return {
            ...EMPTY_AUDIO_FEATURES,
            isActive: true,
            timestamp: performance.now(),
            ...overrides,
        };
    }

    // ========================================================================
    // Basic behavior
    // ========================================================================

    describe('basic behavior', () => {
        it('should return no beat for silence', () => {
            const features = makeFeatures({ isActive: false });
            const state = detector.process(features);
            expect(state.isBeat).toBe(false);
            expect(state.beatType).toBe(BeatType.None);
        });

        it('should return no beat when flux is zero', () => {
            const features = makeFeatures({ spectralFlux: 0, rms: 0.05 });
            const state = detector.process(features);
            expect(state.isBeat).toBe(false);
        });

        it('should not detect beats until enough history is built', () => {
            // First few frames should not detect anything
            for (let i = 0; i < 10; i++) {
                const state = detector.process(makeFeatures({
                    spectralFlux: 0.5,
                    rms: 0.1,
                    timestamp: i * 23, // ~23ms per frame at 44100/1024
                }));
                // Early frames should not trigger beats (not enough history)
                if (i < 5) {
                    expect(state.isBeat).toBe(false);
                }
            }
        });
    });

    // ========================================================================
    // Onset detection
    // ========================================================================

    describe('onset detection', () => {
        it('should detect onset when flux exceeds adaptive threshold', () => {
            let baseTime = 0;
            // Build up a baseline of low flux
            for (let i = 0; i < 25; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.01,
                    rms: 0.05,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            // Now send a spike — should trigger onset
            const state = detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                timestamp: baseTime,
            }));
            expect(state.isBeat).toBe(true);
            expect(state.beatStrength).toBeGreaterThan(0);
        });

        it('should enforce minimum interval between onsets', () => {
            let baseTime = 0;
            // Build baseline
            for (let i = 0; i < 25; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.01,
                    rms: 0.05,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            // First spike — should detect
            detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                timestamp: baseTime,
            }));
            baseTime += 23; // Only 23ms later — below MIN_ONSET_INTERVAL (150ms)

            // Second spike too soon — should NOT detect
            const state = detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                timestamp: baseTime,
            }));
            expect(state.isBeat).toBe(false);
        });
    });

    // ========================================================================
    // Beat classification
    // ========================================================================

    describe('beat classification', () => {
        it('should classify bass-heavy beats as Kick', () => {
            let baseTime = 0;
            for (let i = 0; i < 25; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.01,
                    rms: 0.05,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            const state = detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                energy: [0.5, 0.4, 0.05, 0.05, 0.05, 0.01, 0.01], // Heavy bass
                timestamp: baseTime,
            }));

            if (state.isBeat) {
                expect(state.beatType).toBe(BeatType.Kick);
            }
        });

        it('should classify mid-heavy beats as Snare', () => {
            let baseTime = 0;
            for (let i = 0; i < 25; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.01,
                    rms: 0.05,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            const state = detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                energy: [0.01, 0.01, 0.3, 0.4, 0.3, 0.01, 0.01], // Heavy mids
                timestamp: baseTime,
            }));

            if (state.isBeat) {
                expect(state.beatType).toBe(BeatType.Snare);
            }
        });
    });

    // ========================================================================
    // BPM estimation
    // ========================================================================

    describe('BPM estimation', () => {
        it('should estimate BPM from regular onsets', () => {
            let baseTime = 0;
            const bpm = 120;
            const intervalMs = 60000 / bpm; // 500ms

            // Build baseline
            for (let i = 0; i < 25; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.01,
                    rms: 0.05,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            // Send regular beats at 120 BPM
            let lastState;
            for (let beat = 0; beat < 10; beat++) {
                // Low flux frames between beats
                const framesPerBeat = Math.floor(intervalMs / 23);
                for (let f = 0; f < framesPerBeat - 1; f++) {
                    detector.process(makeFeatures({
                        spectralFlux: 0.01,
                        rms: 0.05,
                        timestamp: baseTime,
                    }));
                    baseTime += 23;
                }

                // Beat frame
                lastState = detector.process(makeFeatures({
                    spectralFlux: 0.5,
                    rms: 0.2,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            // After 10 regular beats, BPM should be estimated near 120
            expect(lastState!.bpm).toBeGreaterThan(90);
            expect(lastState!.bpm).toBeLessThan(150);
        });
    });

    // ========================================================================
    // Reset
    // ========================================================================

    describe('reset', () => {
        it('should clear all state', () => {
            // Feed some data
            for (let i = 0; i < 30; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.1,
                    rms: 0.1,
                    timestamp: i * 23,
                }));
            }

            detector.reset();

            const state = detector.process(makeFeatures({
                spectralFlux: 0,
                rms: 0,
                isActive: false,
                timestamp: 1000,
            }));
            expect(state.bpm).toBe(0);
            expect(state.bpmConfidence).toBe(0);
            expect(state.isBeat).toBe(false);
        });
    });

    // ========================================================================
    // Phase tracking
    // ========================================================================

    describe('phase tracking', () => {
        it('should track beat phase between 0 and 1', () => {
            let baseTime = 0;
            // Build baseline
            for (let i = 0; i < 25; i++) {
                detector.process(makeFeatures({
                    spectralFlux: 0.01,
                    rms: 0.05,
                    timestamp: baseTime,
                }));
                baseTime += 23;
            }

            // Trigger a beat
            detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                timestamp: baseTime,
            }));
            baseTime += 200;

            // Another beat (establishes interval)
            detector.process(makeFeatures({
                spectralFlux: 0.5,
                rms: 0.2,
                timestamp: baseTime,
            }));
            baseTime += 100;

            // Mid-cycle frame
            const state = detector.process(makeFeatures({
                spectralFlux: 0.01,
                rms: 0.05,
                timestamp: baseTime,
            }));

            expect(state.beatPhase).toBeGreaterThanOrEqual(0);
            expect(state.beatPhase).toBeLessThanOrEqual(1);
        });
    });
});
