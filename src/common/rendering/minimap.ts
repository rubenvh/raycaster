import { ICamera } from '../camera';
import { IGeometry } from '../geometry/geometry';
import { IEdge } from '../geometry/edge';
import { Vector, subtract, add, scale, norm, normalize, distance as vecDistance } from '../math/vector';
import { connect } from '../store/store-connector';
import { EMPTY_GEOMETRY } from '../geometry/geometry';
import { DEFAULT_CAMERA } from '../camera';

// Minimap configuration
const MINIMAP_SIZE = 200;       // pixel size of the minimap square
const MINIMAP_MARGIN = 10;      // margin from canvas edge
const MINIMAP_WORLD_RADIUS = 250; // world units visible around camera
const MINIMAP_BG_COLOR = 'rgba(0, 0, 0, 0.55)';
const MINIMAP_EDGE_COLOR = 'rgba(175, 175, 125, 0.9)';
const MINIMAP_IMMATERIAL_COLOR = 'rgba(100, 100, 0, 0.7)';
const MINIMAP_VERTEX_COLOR = 'rgba(200, 200, 200, 0.6)';
const MINIMAP_CAMERA_COLOR = 'rgba(255, 255, 255, 1.0)';
const MINIMAP_DIRECTION_COLOR = 'rgba(0, 200, 255, 0.8)';
const MINIMAP_BORDER_COLOR = 'rgba(255, 255, 255, 0.3)';
const MINIMAP_PATH_COLOR = 'rgba(255, 100, 50, 0.8)';
const MINIMAP_PATH_VISITED_COLOR = 'rgba(255, 100, 50, 0.25)';
const MINIMAP_WAYPOINT_COLOR = 'rgba(255, 180, 50, 0.9)';
const MINIMAP_ACTIVE_WAYPOINT_COLOR = 'rgba(255, 255, 100, 1.0)';
const MINIMAP_VERTEX_RADIUS = 1.5;
const MINIMAP_CAMERA_RADIUS = 3;
const MINIMAP_WAYPOINT_RADIUS = 2;
const MINIMAP_ACTIVE_WAYPOINT_RADIUS = 3;
const MINIMAP_DIRECTION_LENGTH = 20; // pixels

/**
 * Minimap overlay renderer for the player view.
 *
 * Draws a small top-down map in the bottom-right corner of the canvas showing:
 * - Edges (solid and immaterial) within a radius around the camera
 * - Vertices
 * - Camera position and direction indicator
 *
 * Toggle with TAB key. Off by default.
 */
export class MiniMap {
    private visible = false;
    private camera: ICamera = DEFAULT_CAMERA;
    private geometry: IGeometry = EMPTY_GEOMETRY;
    private unsubscribe: () => void;

    // A* path overlay (dance mode only)
    private pathWaypoints: Vector[] = [];
    private pathWaypointIndex = 0;

    constructor() {
        this.unsubscribe = connect(s => {
            this.camera = s.player.camera;
            if (s.walls.geometry !== this.geometry) {
                this.geometry = s.walls.geometry;
            }
        });
    }

    /** Toggle minimap visibility */
    public toggle(): void {
        this.visible = !this.visible;
    }

    /** Whether the minimap is currently shown */
    public isVisible(): boolean {
        return this.visible;
    }

    /**
     * Set the A* path to display on the minimap.
     * Call each frame from the player loop (only in dance mode).
     * Pass empty array to clear.
     */
    public setPath(waypoints: Vector[], waypointIndex: number): void {
        this.pathWaypoints = waypoints;
        this.pathWaypointIndex = waypointIndex;
    }

    /** Draw the minimap onto the given canvas context */
    public draw(context: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
        if (!this.visible) return;

        const cam = this.camera;
        const cx = cam.position[0];
        const cy = cam.position[1];

        // Minimap viewport in canvas pixel coordinates (bottom-right)
        const mapX = canvasWidth - MINIMAP_SIZE - MINIMAP_MARGIN;
        const mapY = canvasHeight - MINIMAP_SIZE - MINIMAP_MARGIN;

        // Conversion: world coords -> minimap pixel coords
        // Center the camera in the minimap, scale world radius to fit
        const worldToMinimap = (wx: number, wy: number): [number, number] => {
            const dx = wx - cx;
            const dy = wy - cy;
            const px = mapX + MINIMAP_SIZE / 2 + (dx / MINIMAP_WORLD_RADIUS) * (MINIMAP_SIZE / 2);
            const py = mapY + MINIMAP_SIZE / 2 + (dy / MINIMAP_WORLD_RADIUS) * (MINIMAP_SIZE / 2);
            return [px, py];
        };

        context.save();

        // Clip to minimap region
        context.beginPath();
        context.rect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);
        context.clip();

        // Background
        context.fillStyle = MINIMAP_BG_COLOR;
        context.fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

        // Draw edges and collect vertices
        const drawnVertices = new Set<string>();
        const verticesToDraw: [number, number][] = [];

        for (const polygon of this.geometry.polygons) {
            for (const edge of polygon.edges) {
                const s0 = edge.start.vector;
                const s1 = edge.end.vector;

                // Quick distance check: skip edges entirely outside view radius
                // Use center of edge for a rough check
                const emx = (s0[0] + s1[0]) / 2;
                const emy = (s0[1] + s1[1]) / 2;
                const edgeDist = Math.sqrt((emx - cx) * (emx - cx) + (emy - cy) * (emy - cy));
                if (edgeDist > MINIMAP_WORLD_RADIUS + (edge.length || 0) / 2) continue;

                // Skip edges with no material (BSP split edges)
                if (edge.material == null) continue;

                const [px0, py0] = worldToMinimap(s0[0], s0[1]);
                const [px1, py1] = worldToMinimap(s1[0], s1[1]);

                context.beginPath();
                context.moveTo(px0, py0);
                context.lineTo(px1, py1);
                context.strokeStyle = edge.immaterial ? MINIMAP_IMMATERIAL_COLOR : MINIMAP_EDGE_COLOR;
                context.lineWidth = 1;
                context.stroke();

                // Collect vertices for drawing (avoid duplicates)
                const k0 = `${s0[0]},${s0[1]}`;
                if (!drawnVertices.has(k0)) {
                    drawnVertices.add(k0);
                    verticesToDraw.push([px0, py0]);
                }
                const k1 = `${s1[0]},${s1[1]}`;
                if (!drawnVertices.has(k1)) {
                    drawnVertices.add(k1);
                    verticesToDraw.push([px1, py1]);
                }
            }
        }

        // Draw vertices
        context.fillStyle = MINIMAP_VERTEX_COLOR;
        for (const [vx, vy] of verticesToDraw) {
            context.beginPath();
            context.arc(vx, vy, MINIMAP_VERTEX_RADIUS, 0, Math.PI * 2);
            context.fill();
        }

        // Draw A* path overlay (if available)
        this.drawPath(context, worldToMinimap);

        // Draw camera position
        const [camPx, camPy] = worldToMinimap(cx, cy);
        context.beginPath();
        context.arc(camPx, camPy, MINIMAP_CAMERA_RADIUS, 0, Math.PI * 2);
        context.fillStyle = MINIMAP_CAMERA_COLOR;
        context.fill();

        // Draw camera direction indicator
        const dirNorm = norm(cam.direction);
        if (dirNorm > 0) {
            const dirUnit = normalize(cam.direction);
            const tipX = camPx + dirUnit[0] * MINIMAP_DIRECTION_LENGTH;
            const tipY = camPy + dirUnit[1] * MINIMAP_DIRECTION_LENGTH;

            context.beginPath();
            context.moveTo(camPx, camPy);
            context.lineTo(tipX, tipY);
            context.strokeStyle = MINIMAP_DIRECTION_COLOR;
            context.lineWidth = 2;
            context.stroke();

            // Small arrowhead
            const arrowSize = 5;
            const angle = Math.atan2(dirUnit[1], dirUnit[0]);
            context.beginPath();
            context.moveTo(tipX, tipY);
            context.lineTo(
                tipX - arrowSize * Math.cos(angle - Math.PI / 6),
                tipY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            context.moveTo(tipX, tipY);
            context.lineTo(
                tipX - arrowSize * Math.cos(angle + Math.PI / 6),
                tipY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            context.stroke();
        }

        context.restore();

        // Draw border (outside clip region)
        context.strokeStyle = MINIMAP_BORDER_COLOR;
        context.lineWidth = 1;
        context.strokeRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);
    }

    /**
     * Draw the A* path on the minimap.
     *
     * Already-traversed segments are drawn faintly, upcoming segments are
     * bright orange, the active waypoint is highlighted in yellow, and
     * remaining waypoints are drawn as small orange dots.
     */
    private drawPath(
        context: CanvasRenderingContext2D,
        worldToMinimap: (wx: number, wy: number) => [number, number],
    ): void {
        const wp = this.pathWaypoints;
        if (wp.length < 2) return;

        const idx = this.pathWaypointIndex;

        // Draw visited (past) segments
        if (idx > 0) {
            context.beginPath();
            const [sx, sy] = worldToMinimap(wp[0][0], wp[0][1]);
            context.moveTo(sx, sy);
            for (let i = 1; i <= Math.min(idx, wp.length - 1); i++) {
                const [px, py] = worldToMinimap(wp[i][0], wp[i][1]);
                context.lineTo(px, py);
            }
            context.strokeStyle = MINIMAP_PATH_VISITED_COLOR;
            context.lineWidth = 1.5;
            context.stroke();
        }

        // Draw upcoming segments
        const startIdx = Math.max(0, idx);
        if (startIdx < wp.length) {
            context.beginPath();
            const [sx, sy] = worldToMinimap(wp[startIdx][0], wp[startIdx][1]);
            context.moveTo(sx, sy);
            for (let i = startIdx + 1; i < wp.length; i++) {
                const [px, py] = worldToMinimap(wp[i][0], wp[i][1]);
                context.lineTo(px, py);
            }
            context.strokeStyle = MINIMAP_PATH_COLOR;
            context.lineWidth = 1.5;
            context.stroke();
        }

        // Draw waypoint dots
        for (let i = 0; i < wp.length; i++) {
            const [px, py] = worldToMinimap(wp[i][0], wp[i][1]);
            const isActive = i === idx;
            context.beginPath();
            context.arc(px, py, isActive ? MINIMAP_ACTIVE_WAYPOINT_RADIUS : MINIMAP_WAYPOINT_RADIUS, 0, Math.PI * 2);
            context.fillStyle = isActive ? MINIMAP_ACTIVE_WAYPOINT_COLOR : MINIMAP_WAYPOINT_COLOR;
            context.fill();
        }
    }

    /** Clean up store subscription */
    public dispose(): void {
        this.unsubscribe();
    }
}
