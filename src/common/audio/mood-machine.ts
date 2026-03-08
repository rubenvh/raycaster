/**
 * Mood state machine: maps audio features and beat state into dance moods.
 * 
 * States: SILENT → CALM → BUILDUP → DROP → GROOVE
 * 
 * Transitions are based on sustained conditions over time, not instantaneous
 * changes. This prevents jittery mood switching on transient audio features.
 * 
 * Each mood drives different choreography parameters:
 * - SILENT: Camera still or drifting very slowly
 * - CALM: Gentle swaying, slow drift, small FOV pulses
 * - BUILDUP: Increasing amplitude, faster movement, growing tension
 * - DROP: Maximum movement, big gestures, strong beat sync
 * - GROOVE: Steady rhythm, confident movement, locked to beat
 */
import { AudioFeatures, BeatState, BeatType, Mood, MoodState, INITIAL_MOOD_STATE } from './model';

// ============================================================================
// Configuration
// ============================================================================

/** Minimum time (ms) to stay in a mood before allowing transition */
const MIN_MOOD_DURATION = 2000;

/** RMS threshold below which we consider silence */
const SILENCE_THRESHOLD = 0.005;

/** RMS threshold above which we consider "loud" (potential drop) */
const LOUD_THRESHOLD = 0.06;

/** Spectral flux threshold for high energy detection */
const HIGH_FLUX_THRESHOLD = 0.02;

/** BPM confidence threshold to enter GROOVE */
const GROOVE_BPM_CONFIDENCE = 0.5;

/** Consecutive frames of condition before transitioning */
const TRANSITION_FRAMES = 10;

/** Time (ms) of sustained high energy before transitioning to DROP */
const DROP_SUSTAIN_TIME = 500;

/** Time (ms) of sustained silence before transitioning to SILENT */
const SILENCE_SUSTAIN_TIME = 1500;

// ============================================================================
// Mood State Machine
// ============================================================================

export class MoodMachine {
    private state: MoodState = { ...INITIAL_MOOD_STATE };

    // Transition accumulators: count consecutive frames meeting a condition
    private silenceFrames = 0;
    private calmFrames = 0;
    private loudFrames = 0;
    private grooveFrames = 0;
    private buildupFrames = 0;

    // Smoothed audio metrics for more stable transitions
    private smoothRms = 0;
    private smoothFlux = 0;
    private smoothCentroid = 0;

    /** Get the current mood state (read-only snapshot) */
    get current(): MoodState {
        return { ...this.state };
    }

    /**
     * Process audio features and beat state to update the mood.
     * Call this once per audio analysis frame.
     */
    process(features: AudioFeatures, beat: BeatState, deltaTime: number): MoodState {
        // Smooth audio features with exponential moving average
        const alpha = 0.15;
        this.smoothRms = this.smoothRms * (1 - alpha) + features.rms * alpha;
        this.smoothFlux = this.smoothFlux * (1 - alpha) + features.spectralFlux * alpha;
        this.smoothCentroid = this.smoothCentroid * (1 - alpha) + features.spectralCentroid * alpha;

        // Update mood duration
        this.state.duration += deltaTime;

        // Ramp up intensity within current mood (0 → 1 over ~3 seconds)
        this.state.intensity = Math.min(1, this.state.duration / 3000);

        // Evaluate transitions
        const canTransition = this.state.duration >= MIN_MOOD_DURATION;
        const newMood = this.evaluateTransition(features, beat, canTransition);

        if (newMood !== null && newMood !== this.state.current) {
            this.state = {
                current: newMood,
                duration: 0,
                intensity: 0,
                lastTransitionTime: features.timestamp,
            };
            this.resetAccumulators();
        }

        return this.current;
    }

    /** Reset the state machine */
    reset(): void {
        this.state = { ...INITIAL_MOOD_STATE };
        this.resetAccumulators();
        this.smoothRms = 0;
        this.smoothFlux = 0;
        this.smoothCentroid = 0;
    }

    // ========================================================================
    // Transition Logic
    // ========================================================================

    private evaluateTransition(features: AudioFeatures, beat: BeatState, canTransition: boolean): Mood | null {
        // Count condition frames
        this.updateAccumulators(features, beat);

        // Priority-based transition evaluation
        // 1. Any mood → SILENT (if sustained silence)
        if (this.silenceFrames >= TRANSITION_FRAMES) {
            return Mood.Silent;
        }

        if (!canTransition) return null;

        switch (this.state.current) {
            case Mood.Silent:
                return this.fromSilent(features, beat);
            case Mood.Calm:
                return this.fromCalm(features, beat);
            case Mood.Buildup:
                return this.fromBuildup(features, beat);
            case Mood.Drop:
                return this.fromDrop(features, beat);
            case Mood.Groove:
                return this.fromGroove(features, beat);
        }

        return null;
    }

    private fromSilent(features: AudioFeatures, beat: BeatState): Mood | null {
        // Any audio detected → CALM
        if (this.calmFrames >= TRANSITION_FRAMES / 2) {
            return Mood.Calm;
        }
        return null;
    }

    private fromCalm(features: AudioFeatures, beat: BeatState): Mood | null {
        // Loud and rhythmic → GROOVE
        if (this.grooveFrames >= TRANSITION_FRAMES) {
            return Mood.Groove;
        }
        // Rising energy → BUILDUP
        if (this.buildupFrames >= TRANSITION_FRAMES) {
            return Mood.Buildup;
        }
        // Very loud → DROP directly
        if (this.loudFrames >= TRANSITION_FRAMES) {
            return Mood.Drop;
        }
        return null;
    }

    private fromBuildup(features: AudioFeatures, beat: BeatState): Mood | null {
        // Sustained loud → DROP
        if (this.loudFrames >= TRANSITION_FRAMES) {
            return Mood.Drop;
        }
        // Strong beat with confidence → GROOVE
        if (this.grooveFrames >= TRANSITION_FRAMES) {
            return Mood.Groove;
        }
        // Energy dropped → CALM
        if (this.calmFrames >= TRANSITION_FRAMES) {
            return Mood.Calm;
        }
        return null;
    }

    private fromDrop(features: AudioFeatures, beat: BeatState): Mood | null {
        // Settled into rhythm → GROOVE
        if (this.grooveFrames >= TRANSITION_FRAMES * 2) {
            return Mood.Groove;
        }
        // Energy dropped → CALM
        if (this.calmFrames >= TRANSITION_FRAMES * 2) {
            return Mood.Calm;
        }
        return null;
    }

    private fromGroove(features: AudioFeatures, beat: BeatState): Mood | null {
        // Energy spike → DROP
        if (this.loudFrames >= TRANSITION_FRAMES) {
            return Mood.Drop;
        }
        // Lost the beat → CALM
        if (this.calmFrames >= TRANSITION_FRAMES * 2) {
            return Mood.Calm;
        }
        // Rising energy → BUILDUP
        if (this.buildupFrames >= TRANSITION_FRAMES * 2) {
            return Mood.Buildup;
        }
        return null;
    }

    // ========================================================================
    // Accumulator Management
    // ========================================================================

    private updateAccumulators(features: AudioFeatures, beat: BeatState): void {
        const rms = this.smoothRms;
        const flux = this.smoothFlux;

        // Silence detection
        if (rms < SILENCE_THRESHOLD) {
            this.silenceFrames++;
        } else {
            this.silenceFrames = 0;
        }

        // Calm: audio present but not loud
        if (rms >= SILENCE_THRESHOLD && rms < LOUD_THRESHOLD) {
            this.calmFrames++;
        } else {
            this.calmFrames = Math.max(0, this.calmFrames - 1);
        }

        // Loud: high energy
        if (rms >= LOUD_THRESHOLD && flux > HIGH_FLUX_THRESHOLD * 0.5) {
            this.loudFrames++;
        } else {
            this.loudFrames = Math.max(0, this.loudFrames - 1);
        }

        // Groove: steady beat detected
        if (beat.bpmConfidence >= GROOVE_BPM_CONFIDENCE && rms >= SILENCE_THRESHOLD * 2) {
            this.grooveFrames++;
        } else {
            this.grooveFrames = Math.max(0, this.grooveFrames - 1);
        }

        // Buildup: rising energy, moderate flux
        if (rms >= SILENCE_THRESHOLD * 3 && rms < LOUD_THRESHOLD && flux > HIGH_FLUX_THRESHOLD * 0.3) {
            this.buildupFrames++;
        } else {
            this.buildupFrames = Math.max(0, this.buildupFrames - 1);
        }
    }

    private resetAccumulators(): void {
        this.silenceFrames = 0;
        this.calmFrames = 0;
        this.loudFrames = 0;
        this.grooveFrames = 0;
        this.buildupFrames = 0;
    }
}
