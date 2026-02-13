/**
 * Seeded random number generator for reproducible test data generation.
 * 
 * Uses a linear congruential generator algorithm for consistent,
 * deterministic random sequences given the same seed.
 */
export class SeededRandom {
    private _seed: number;
    private _initialSeed: number;

    constructor(seed: number = 42) {
        this._seed = seed;
        this._initialSeed = seed;
    }

    /** Get current seed value */
    get seed(): number {
        return this._seed;
    }

    /** Set seed value (resets the sequence) */
    set seed(value: number) {
        this._seed = value;
    }

    /** Reset to initial seed */
    reset(): void {
        this._seed = this._initialSeed;
    }

    /** Generate next random number in [0, 1) */
    next(): number {
        // Linear congruential generator
        this._seed = (this._seed * 1103515245 + 12345) & 0x7fffffff;
        return this._seed / 0x7fffffff;
    }

    /** Generate random number in [min, max) */
    nextFloat(min: number = 0, max: number = 1): number {
        return min + this.next() * (max - min);
    }

    /** Generate random integer in [min, max] inclusive */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /** Generate random boolean with given probability of true */
    nextBool(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    /** Pick a random element from an array */
    pick<T>(array: T[]): T {
        return array[this.nextInt(0, array.length - 1)];
    }

    /** Shuffle an array in place */
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

/** Default shared instance for tests - seed 42 for reproducibility */
export const testRandom = new SeededRandom(42);

/** Reset the shared test random to its initial seed */
export const resetTestRandom = (seed: number = 42): void => {
    testRandom.seed = seed;
};
