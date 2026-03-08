/**
 * Audio capture service: microphone input + Meyda feature extraction.
 * 
 * Captures live audio from the microphone via Web Audio API and feeds
 * it through Meyda for real-time feature extraction. Produces AudioFeatures
 * objects consumed by the beat detector and mood state machine.
 * 
 * This module runs in the Electron renderer process and requires
 * navigator.mediaDevices.getUserMedia access (CSP must include media-src).
 */
import { AudioFeatures, EMPTY_AUDIO_FEATURES, AudioCaptureConfig, DEFAULT_AUDIO_CONFIG } from './model';

// ============================================================================
// Types
// ============================================================================

/** Callback invoked for each analysis frame */
export type AudioFeaturesCallback = (features: AudioFeatures) => void;

/** Meyda analyzer interface (subset of meyda's API we use) */
interface MeydaAnalyzer {
    start(): void;
    stop(): void;
}

/** Meyda library interface (subset we use) */
interface MeydaStatic {
    createMeydaAnalyzer(options: {
        audioContext: AudioContext;
        source: AudioNode;
        bufferSize: number;
        featureExtractors: string[];
        callback: (features: any) => void;
    }): MeydaAnalyzer;
}

// ============================================================================
// Audio Capture Service
// ============================================================================

export class AudioCaptureService {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private analyzer: MeydaAnalyzer | null = null;
    private callback: AudioFeaturesCallback | null = null;
    private config: AudioCaptureConfig;
    private running = false;
    private previousRms = 0; // For computing spectral flux approximation

    constructor(config: Partial<AudioCaptureConfig> = {}) {
        this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
    }

    /** Whether the service is currently capturing and analyzing audio */
    get isRunning(): boolean { return this.running; }

    /**
     * Start capturing audio from the microphone.
     * @param callback Called for each analysis frame with extracted features
     */
    async start(callback: AudioFeaturesCallback): Promise<void> {
        if (this.running) return;

        this.callback = callback;

        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });

            // Create audio context
            const sampleRate = this.config.sampleRate > 0 ? this.config.sampleRate : undefined;
            this.audioContext = new AudioContext({ sampleRate });
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Import Meyda (bundled by webpack)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Meyda: MeydaStatic = require('meyda').default || require('meyda');

            // Create Meyda analyzer
            this.analyzer = Meyda.createMeydaAnalyzer({
                audioContext: this.audioContext,
                source: this.sourceNode,
                bufferSize: this.config.bufferSize,
                featureExtractors: this.config.features,
                callback: (features: any) => {
                    // Meyda's spectralFlux throws on the first frame because
                    // there is no previous spectrum yet. Swallow errors so one
                    // bad frame doesn't kill the pipeline.
                    try {
                        this.onFeatures(features);
                    } catch (_) { /* skip frame */ }
                },
            });

            this.analyzer!.start();
            this.running = true;
        } catch (err) {
            this.dispose();
            throw err;
        }
    }

    /** Stop capturing audio and release resources */
    stop(): void {
        this.dispose();
    }

    /** Process raw Meyda features into our AudioFeatures type */
    private onFeatures(raw: any): void {
        if (!this.callback) return;

        const rms = raw.rms ?? 0;

        // Approximate spectral flux from frame-to-frame RMS change.
        // Meyda's built-in spectralFlux throws on the first frame (no previous
        // spectrum), so we compute our own proxy. The half-wave rectified RMS
        // delta captures onsets (sudden loudness increases) which is what the
        // beat detector needs.
        const spectralFlux = Math.max(0, rms - this.previousRms);
        this.previousRms = rms;

        const features: AudioFeatures = {
            rms,
            spectralCentroid: raw.spectralCentroid ?? 0,
            spectralFlux,
            spectralRolloff: raw.spectralRolloff ?? 0,
            zcr: raw.zcr ?? 0,
            energy: raw.energy ?? [0, 0, 0, 0, 0, 0, 0],
            mfcc: raw.mfcc ?? [],
            isActive: rms > 0.003, // Silence threshold — low to catch bass guitar through laptop mic
            timestamp: performance.now(),
        };

        this.callback(features);
    }

    /** Clean up all audio resources */
    private dispose(): void {
        this.running = false;

        if (this.analyzer) {
            try { this.analyzer.stop(); } catch (_) {}
            this.analyzer = null;
        }

        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (_) {}
            this.sourceNode = null;
        }

        if (this.audioContext) {
            try { this.audioContext.close(); } catch (_) {}
            this.audioContext = null;
        }

        if (this.mediaStream) {
            for (const track of this.mediaStream.getTracks()) {
                track.stop();
            }
            this.mediaStream = null;
        }
    }
}
