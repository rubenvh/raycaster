/**
 * Centralized resolution configuration.
 *
 * The 3D rendering width (number of ray columns) was previously hardcoded as
 * 640 in four separate locations.  This module provides a single source of
 * truth plus getter/setter so the value can be overridden at startup (e.g.
 * via a --resolution CLI flag passed through to the renderer process).
 *
 * Height is always derived as Math.round(width * 3 / 4) to maintain a 4:3
 * aspect ratio.
 */

const DEFAULT_RESOLUTION = 640;

let _resolution: number = DEFAULT_RESOLUTION;

/**
 * Get the current rendering resolution (width in pixels / ray columns).
 */
export function getResolution(): number {
    return _resolution;
}

/**
 * Get the rendering height derived from the current resolution (4:3 aspect).
 */
export function getResolutionHeight(): number {
    return Math.round(_resolution * 3 / 4);
}

/**
 * Set the rendering resolution.  Must be called **before** any renderer is
 * constructed — the renderers read this value once in their constructor.
 *
 * @param width  Desired screen width in pixels.  Must be a positive integer.
 *               Values below 160 or above 3840 are clamped for sanity.
 */
export function setResolution(width: number): void {
    const clamped = Math.round(Math.max(160, Math.min(3840, width)));
    _resolution = clamped;
}
