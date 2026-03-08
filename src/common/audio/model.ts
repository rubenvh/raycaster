/**
 * Audio analysis and dance mode shared interfaces.
 * 
 * These types define the data flow from microphone capture through
 * beat detection, mood analysis, and choreography output.
 */

// ============================================================================
// Audio Features (raw output from Meyda)
// ============================================================================

/** Raw audio features extracted per analysis frame by Meyda */
export type AudioFeatures = {
    /** Root mean square energy (0-1 range, overall loudness) */
    rms: number;
    /** Spectral centroid (brightness — higher = more treble) */
    spectralCentroid: number;
    /** Spectral flux (rate of spectral change — useful for onset detection) */
    spectralFlux: number;
    /** Spectral rolloff (frequency below which 85% of energy lies) */
    spectralRolloff: number;
    /** Zero crossing rate (noisiness indicator) */
    zcr: number;
    /** Energy in each frequency band [sub-bass, bass, low-mid, mid, upper-mid, presence, brilliance] */
    energy: number[];
    /** MFCC coefficients (timbral fingerprint) */
    mfcc: number[];
    /** Whether the audio source is active (non-silent) */
    isActive: boolean;
    /** Timestamp of this analysis frame (ms) */
    timestamp: number;
};

export const EMPTY_AUDIO_FEATURES: AudioFeatures = {
    rms: 0,
    spectralCentroid: 0,
    spectralFlux: 0,
    spectralRolloff: 0,
    zcr: 0,
    energy: [0, 0, 0, 0, 0, 0, 0],
    mfcc: [],
    isActive: false,
    timestamp: 0,
};

// ============================================================================
// Beat Detection
// ============================================================================

/** Classification of detected beat type */
export enum BeatType {
    None = 'none',
    Kick = 'kick',       // Low-frequency transient (bass drum)
    Snare = 'snare',     // Mid/high-frequency transient (snare, clap)
    HiHat = 'hihat',     // High-frequency transient (hi-hat, cymbal)
}

/** State of the beat detector at a given moment */
export type BeatState = {
    /** Whether a beat was detected on this frame */
    isBeat: boolean;
    /** Classification of the beat */
    beatType: BeatType;
    /** Strength of the detected beat (0-1) */
    beatStrength: number;
    /** Current estimated BPM (0 if unknown) */
    bpm: number;
    /** Confidence in BPM estimate (0-1) */
    bpmConfidence: number;
    /** Time since last beat (ms) */
    timeSinceLastBeat: number;
    /** Expected time until next beat (ms), based on BPM */
    timeUntilNextBeat: number;
    /** Phase within the current beat cycle (0-1, where 0 = on beat) */
    beatPhase: number;
    /** Timestamp of this beat state (ms) */
    timestamp: number;
};

export const EMPTY_BEAT_STATE: BeatState = {
    isBeat: false,
    beatType: BeatType.None,
    beatStrength: 0,
    bpm: 0,
    bpmConfidence: 0,
    timeSinceLastBeat: Infinity,
    timeUntilNextBeat: Infinity,
    beatPhase: 0,
    timestamp: 0,
};

// ============================================================================
// Mood / State Machine
// ============================================================================

/** Mood states for the dance choreography state machine */
export enum Mood {
    /** No music detected — camera is still or subtly drifting */
    Silent = 'silent',
    /** Quiet, ambient music — gentle swaying, slow drifting */
    Calm = 'calm',
    /** Energy rising — increasing movement amplitude, building anticipation */
    Buildup = 'buildup',
    /** High energy peak — maximum movement, big gestures */
    Drop = 'drop',
    /** Steady rhythm — locked to beat, confident movement */
    Groove = 'groove',
}

/** Full mood state including transition info */
export type MoodState = {
    /** Current mood */
    current: Mood;
    /** How long we've been in this mood (ms) */
    duration: number;
    /** Intensity within this mood (0-1), ramps up over time */
    intensity: number;
    /** Timestamp of last mood transition */
    lastTransitionTime: number;
};

export const INITIAL_MOOD_STATE: MoodState = {
    current: Mood.Silent,
    duration: 0,
    intensity: 0,
    lastTransitionTime: 0,
};

// ============================================================================
// Dance Choreography Output
// ============================================================================

/** Camera movement deltas produced by the choreographer each frame */
export type DanceMovement = {
    /** Forward/backward movement magnitude (positive = forward) */
    forward: number;
    /** Left/right strafe magnitude (positive = right) */
    strafe: number;
    /** Rotation amount in radians (positive = turn right) */
    rotation: number;
    /** Depth pulse factor (> 1 = zoom in, < 1 = zoom out, 1 = no change) */
    depthPulse: number;
    /** FOV pulse factor (> 1 = widen, < 1 = narrow, 1 = no change) */
    fovPulse: number;
};

export const ZERO_MOVEMENT: DanceMovement = {
    forward: 0,
    strafe: 0,
    rotation: 0,
    depthPulse: 1,
    fovPulse: 1,
};

// ============================================================================
// Audio Capture Configuration
// ============================================================================

export type AudioCaptureConfig = {
    /** FFT buffer size (power of 2, typically 512 or 1024) */
    bufferSize: number;
    /** Sample rate (typically 44100 or 48000, 0 = use device default) */
    sampleRate: number;
    /** Meyda features to extract */
    features: string[];
};

export const DEFAULT_AUDIO_CONFIG: AudioCaptureConfig = {
    bufferSize: 512,
    sampleRate: 0,
    // Note: spectralFlux is NOT requested from Meyda because it throws on the
    // first frame (no previous spectrum). We compute it ourselves in AudioCaptureService.
    features: ['rms', 'spectralCentroid', 'spectralRolloff', 'zcr', 'energy', 'mfcc'],
};
