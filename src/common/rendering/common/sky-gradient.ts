import { ISkyGradient, RGBColor } from '../../store/world-config';

/**
 * Creates a CanvasGradient for the sky gradient, taking into account
 * crossover position and width parameters.
 *
 * The gradient spans the top half of the canvas (y=0 to y=skyHeight).
 * - `crossoverPosition` (0–1, default 0.5): where the midpoint of the
 *   color transition sits within the sky area.
 * - `crossoverWidth` (0–1, default 1.0): how wide the transition band is.
 *   At 1.0, the gradient spans the entire sky area. At 0.0, it's a hard line.
 *
 * Outside the transition band the colors are solid (topColor above, bottomColor below).
 */
export function createSkyGradient(
    ctx: CanvasRenderingContext2D,
    gradient: ISkyGradient,
    canvasWidth: number,
    skyHeight: number,
): CanvasGradient {
    const position = gradient.crossoverPosition ?? 0.5;
    const width = gradient.crossoverWidth ?? 1.0;

    const transitionStart = Math.max(0, Math.min(1, position - width / 2));
    const transitionEnd = Math.max(0, Math.min(1, position + width / 2));

    const [tr, tg, tb] = gradient.topColor;
    const [br, bg, bb] = gradient.bottomColor;
    const topRgb = `rgb(${tr},${tg},${tb})`;
    const bottomRgb = `rgb(${br},${bg},${bb})`;

    const g = ctx.createLinearGradient(0, 0, 0, skyHeight);
    g.addColorStop(0, topRgb);
    if (transitionStart > 0) {
        g.addColorStop(transitionStart, topRgb);
    }
    if (transitionEnd < 1) {
        g.addColorStop(transitionEnd, bottomRgb);
    }
    g.addColorStop(1, bottomRgb);

    return g;
}
