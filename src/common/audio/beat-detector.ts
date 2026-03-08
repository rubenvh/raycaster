/**
 * Beat detector: onset detection, BPM tracking, and beat classification.
 * 
 * Processes AudioFeatures from the capture service and produces BeatState
 * objects that tell the choreographer when beats occur, their type (kick/snare),
 * the current BPM, and the phase within the beat cycle.
 * 
 * Algorithm:
 * 1. Onset detection via spectral flux threshold (adaptive)
 * 2. BPM estimation from inter-onset intervals
 * 3. Beat type classification from frequency band energy ratios
 * 4. Beat phase tracking for smooth animation sync
 */
import { AudioFeatures, BeatState, BeatType, EMPTY_BEAT_STATE } from './model';

// ============================================================================
// Configuration
// ============================================================================

/** Number of recent spectral flux values to maintain for adaptive threshold */
const FLUX_HISTORY_SIZE = 43; // ~1 second at 44100Hz / 1024 buffer

/** Multiplier above average spectral flux to count as an onset */
const ONSET_THRESHOLD_MULTIPLIER = 1.5;

/** Minimum time between onsets (ms) — prevents double-triggering */
const MIN_ONSET_INTERVAL = 150;

/** Number of inter-onset intervals to track for BPM calculation */
const IOI_HISTORY_SIZE = 16;

/** BPM range to consider valid */
const MIN_BPM = 60;
const MAX_BPM = 200;

/** Low-frequency energy band indices for kick detection */
const KICK_BANDS = [0, 1]; // sub-bass, bass

/** Mid/high-frequency energy band indices for snare detection */
const SNARE_BANDS = [2, 3, 4]; // low-mid, mid, upper-mid

/** Energy ratio threshold: kick vs snare classification */
const KICK_RATIO_THRESHOLD = 1.5;

// ============================================================================
// Beat Detector
// ============================================================================

export class BeatDetector {
    // Spectral flux history for adaptive threshold
    private fluxHistory: number[] = [];
    private fluxSum = 0;

    // Onset timing
    private lastOnsetTime = 0;
    private onsetTimes: number[] = [];

    // BPM estimation
    private ioiHistory: number[] = []; // inter-onset intervals
    private currentBpm = 0;
    private bpmConfidence = 0;

    // Beat phase tracking
    private lastBeatTime = 0;
    private beatInterval = 0; // ms between beats at current BPM

    // Previous frame features (for flux delta)
    private previousRms = 0;

    /**
     * Process a frame of audio features and produce beat state.
     */
    process(features: AudioFeatures): BeatState {
        const now = features.timestamp;

        if (!features.isActive) {
            return {
                ...EMPTY_BEAT_STATE,
                bpm: this.currentBpm,
                bpmConfidence: this.bpmConfidence * 0.99, // Decay confidence during silence
                timeSinceLastBeat: now - this.lastBeatTime,
                timeUntilNextBeat: this.predictNextBeat(now),
                beatPhase: this.calculatePhase(now),
                timestamp: now,
            };
        }

        // Step 1: Onset detection using spectral flux
        const flux = features.spectralFlux;
        const isOnset = this.detectOnset(flux, now);

        // Step 2: BPM tracking
        if (isOnset) {
            this.recordOnset(now);
        }

        // Step 3: Beat classification
        const beatType = isOnset ? this.classifyBeat(features) : BeatType.None;

        // Step 4: Beat strength estimation
        const beatStrength = isOnset ? Math.min(1, flux / (this.getFluxAverage() * 3)) : 0;

        // Update beat phase tracking
        if (isOnset) {
            this.lastBeatTime = now;
        }

        this.previousRms = features.rms;

        return {
            isBeat: isOnset,
            beatType,
            beatStrength,
            bpm: this.currentBpm,
            bpmConfidence: this.bpmConfidence,
            timeSinceLastBeat: now - this.lastBeatTime,
            timeUntilNextBeat: this.predictNextBeat(now),
            beatPhase: this.calculatePhase(now),
            timestamp: now,
        };
    }

    /** Reset the detector state */
    reset(): void {
        this.fluxHistory = [];
        this.fluxSum = 0;
        this.lastOnsetTime = 0;
        this.onsetTimes = [];
        this.ioiHistory = [];
        this.currentBpm = 0;
        this.bpmConfidence = 0;
        this.lastBeatTime = 0;
        this.beatInterval = 0;
        this.previousRms = 0;
    }

    // ========================================================================
    // Onset Detection
    // ========================================================================

    private detectOnset(flux: number, now: number): boolean {
        // Add to flux history
        this.fluxHistory.push(flux);
        this.fluxSum += flux;
        if (this.fluxHistory.length > FLUX_HISTORY_SIZE) {
            this.fluxSum -= this.fluxHistory.shift()!;
        }

        // Need at least half the history to establish a baseline
        if (this.fluxHistory.length < FLUX_HISTORY_SIZE / 2) return false;

        // Adaptive threshold: flux must exceed average by a multiplier
        const average = this.getFluxAverage();
        const threshold = average * ONSET_THRESHOLD_MULTIPLIER;

        // Check minimum interval between onsets
        if (now - this.lastOnsetTime < MIN_ONSET_INTERVAL) return false;

        if (flux > threshold && flux > 0.0001) {
            this.lastOnsetTime = now;
            return true;
        }

        return false;
    }

    private getFluxAverage(): number {
        if (this.fluxHistory.length === 0) return 0;
        return this.fluxSum / this.fluxHistory.length;
    }

    // ========================================================================
    // BPM Estimation
    // ========================================================================

    private recordOnset(now: number): void {
        this.onsetTimes.push(now);

        // Keep only recent onsets
        while (this.onsetTimes.length > IOI_HISTORY_SIZE + 1) {
            this.onsetTimes.shift();
        }

        if (this.onsetTimes.length < 3) return;

        // Calculate inter-onset intervals
        const intervals: number[] = [];
        for (let i = 1; i < this.onsetTimes.length; i++) {
            intervals.push(this.onsetTimes[i] - this.onsetTimes[i - 1]);
        }

        this.ioiHistory = intervals;

        // Estimate BPM: use median IOI (robust to outliers)
        const sorted = [...intervals].sort((a, b) => a - b);
        const medianIOI = sorted[Math.floor(sorted.length / 2)];

        if (medianIOI > 0) {
            const bpm = 60000 / medianIOI;

            // Only accept BPM in valid range
            if (bpm >= MIN_BPM && bpm <= MAX_BPM) {
                // Smooth BPM updates
                if (this.currentBpm === 0) {
                    this.currentBpm = bpm;
                } else {
                    this.currentBpm = this.currentBpm * 0.7 + bpm * 0.3;
                }
                this.beatInterval = 60000 / this.currentBpm;

                // Confidence based on IOI consistency
                const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
                const variance = intervals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / intervals.length;
                const cv = Math.sqrt(variance) / mean; // Coefficient of variation
                this.bpmConfidence = Math.max(0, Math.min(1, 1 - cv));
            } else if (bpm > MAX_BPM) {
                // Try halving the BPM (double the interval)
                const halfBpm = bpm / 2;
                if (halfBpm >= MIN_BPM) {
                    this.currentBpm = this.currentBpm * 0.7 + halfBpm * 0.3;
                    this.beatInterval = 60000 / this.currentBpm;
                }
            }
        }
    }

    // ========================================================================
    // Beat Classification
    // ========================================================================

    private classifyBeat(features: AudioFeatures): BeatType {
        if (!features.energy || features.energy.length < 5) return BeatType.Kick;

        // Sum energy in low bands (kick) and mid bands (snare)
        let kickEnergy = 0;
        for (const i of KICK_BANDS) {
            kickEnergy += features.energy[i] ?? 0;
        }

        let snareEnergy = 0;
        for (const i of SNARE_BANDS) {
            snareEnergy += features.energy[i] ?? 0;
        }

        // Check for hi-hat (high frequency, low overall energy)
        const highEnergy = (features.energy[5] ?? 0) + (features.energy[6] ?? 0);
        if (highEnergy > kickEnergy && highEnergy > snareEnergy && features.rms < 0.1) {
            return BeatType.HiHat;
        }

        // Kick vs snare: compare energy ratios
        if (kickEnergy > snareEnergy * KICK_RATIO_THRESHOLD) {
            return BeatType.Kick;
        }
        if (snareEnergy > kickEnergy) {
            return BeatType.Snare;
        }

        return BeatType.Kick; // Default to kick for ambiguous beats
    }

    // ========================================================================
    // Phase Tracking
    // ========================================================================

    private predictNextBeat(now: number): number {
        if (this.beatInterval <= 0 || this.lastBeatTime === 0) return Infinity;
        const elapsed = now - this.lastBeatTime;
        const remaining = this.beatInterval - (elapsed % this.beatInterval);
        return remaining;
    }

    private calculatePhase(now: number): number {
        if (this.beatInterval <= 0 || this.lastBeatTime === 0) return 0;
        const elapsed = now - this.lastBeatTime;
        return (elapsed % this.beatInterval) / this.beatInterval;
    }
}
