import { isPolygon, SelectableElement } from '../selection/selectable';
import { IPolygon, centerOf, merge } from "../geometry/polygon";
import { IActionHandler } from "./actions";
import { ISpaceTranslator } from "./geometrySelector";
import { drawSegment, drawVector } from '../drawing/drawing';
import { EMPTY_GEOMETRY, rotatePolygon } from '../geometry/geometry';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { Vector, distance, subtract, angleBetween, rotate, add } from '../math/vector';

/// <reference path="../../renderer/electron.d.ts" />

const SNAP_THRESHOLD = 10;
const ANGLE_SNAP_INCREMENT = Math.PI / 12; // 15 degrees

type SnapTarget = { point: Vector; label: 'vertex' | 'center' };

const dispatch = useAppDispatch();
export class PolygonRotator implements IActionHandler {

    private phase: 'idle' | 'selectingCenter' | 'rotating' = 'idle';
    private candidates: IPolygon[] = [];
    private selectedElements: SelectableElement[] = [];
    private wallGeometry = EMPTY_GEOMETRY;
    private unsubscribe: () => void;
    private registeredElement: GlobalEventHandlers | null = null;

    // Phase 1 state: center selection
    private snapTargets: SnapTarget[] = [];
    private hoveredSnapTarget: SnapTarget | null = null;
    private mousePosition: Vector | null = null;

    // Phase 2 state: rotation
    private rotationCenter: Vector | null = null;

    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            this.unsubscribe = connect(s => {
                this.selectedElements = s.selection.elements;
                this.wallGeometry = s.walls.geometry;
            });
        }

    private get selectedPolygons(): IPolygon[] {
        return this.selectedElements.filter(isPolygon).map(_ => _.polygon);
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.registeredElement = g;
        window.electronAPI.on('geometry_polygon_rotate', this.startRotation);
        g.addEventListener('mousemove', this.handleMouseMove);
        g.addEventListener('mouseup', this.handleMouseUp);
        g.addEventListener('contextmenu', this.cancel, false);
        window.addEventListener('keydown', this.handleKeyDown, false);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_polygon_rotate', this.startRotation);
        window.removeEventListener('keydown', this.handleKeyDown, false);
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('mousemove', this.handleMouseMove);
            this.registeredElement.removeEventListener('mouseup', this.handleMouseUp);
            this.registeredElement.removeEventListener('contextmenu', this.cancel, false);
        }
    }

    handle(_deltaTime: number): void {
        if (this.phase === 'selectingCenter') {
            this.drawCenterSelection();
        } else if (this.phase === 'rotating') {
            this.drawRotationPreview();
        }
    }

    public isActive = () => this.phase !== 'idle';

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.phase !== 'idle') {
            this.cancel();
        }
    };

    private startRotation = () => {
        if (!this.canActivate()) return;
        this.phase = 'selectingCenter';
        this.computeSnapTargets();
    };

    private canActivate = () => this.selectedPolygons.length >= 1;

    private cancel = () => {
        this.phase = 'idle';
        this.candidates = [];
        this.snapTargets = [];
        this.hoveredSnapTarget = null;
        this.mousePosition = null;
        this.rotationCenter = null;
    };

    private computeSnapTargets = () => {
        const polygons = this.selectedPolygons;
        const targets: SnapTarget[] = [];

        // Add all vertices of selected polygons
        for (const polygon of polygons) {
            for (const vertex of polygon.vertices) {
                targets.push({ point: vertex.vector, label: 'vertex' });
            }
        }

        // Add the center of the merged bounding box
        if (polygons.length > 0) {
            const mergedBox = polygons.slice(1).reduce(
                (acc, p) => merge(acc, p.boundingBox),
                polygons[0].boundingBox
            );
            targets.push({ point: centerOf(mergedBox), label: 'center' });
        }

        this.snapTargets = targets;
    };

    private findNearestSnapTarget = (worldPos: Vector): SnapTarget | null => {
        let nearest: SnapTarget | null = null;
        let nearestDist = Infinity;

        for (const target of this.snapTargets) {
            const d = distance(target.point, worldPos);
            if (d <= SNAP_THRESHOLD && d < nearestDist) {
                nearest = target;
                nearestDist = d;
            }
        }

        return nearest;
    };

    // --- Mouse handlers ---

    private handleMouseMove = (event: MouseEvent): boolean => {
        if (this.phase === 'idle') return false;

        const worldPos = this.spaceTranslator.toWorldSpace(event);
        this.mousePosition = worldPos;

        if (this.phase === 'selectingCenter') {
            this.hoveredSnapTarget = this.findNearestSnapTarget(worldPos);
            return true;
        }

        if (this.phase === 'rotating') {
            const target = this.computeRotationTarget(event);
            const selectedPolygonIds = this.selectedPolygons.map(_ => _.id);
            const newGeometry = rotatePolygon(
                selectedPolygonIds,
                target,
                this.wallGeometry,
                this.rotationCenter!
            );
            this.candidates = newGeometry.polygons.filter(p => selectedPolygonIds.includes(p.id));
            return true;
        }

        return false;
    };

    private handleMouseUp = (event: MouseEvent): boolean => {
        if (event.button !== 0) return false;
        if (this.phase === 'idle') return false;

        if (this.phase === 'selectingCenter') {
            event.stopImmediatePropagation();
            const worldPos = this.spaceTranslator.toWorldSpace(event);
            // Use snapped position if hovering a snap target, otherwise raw mouse position
            this.rotationCenter = this.hoveredSnapTarget
                ? this.hoveredSnapTarget.point
                : worldPos;
            this.phase = 'rotating';
            this.hoveredSnapTarget = null;
            return true;
        }

        if (this.phase === 'rotating') {
            event.stopImmediatePropagation();
            const target = this.computeRotationTarget(event);
            dispatch(actions.rotatePolygon({
                polygons: this.selectedPolygons.map(x => x.id),
                rotation: target,
                center: this.rotationCenter!
            }));
            this.cancel();
            return true;
        }

        return false;
    };

    // --- Rotation computation ---

    private computeRotationTarget = (event: MouseEvent): Vector => {
        const worldPos = this.spaceTranslator.toWorldSpace(event);

        if (!event.ctrlKey) {
            return worldPos;
        }

        // Angle snapping: compute the angle, snap to 15-degree increments,
        // then produce a synthetic target point at the snapped angle.
        const center = this.rotationCenter!;
        const polygons = this.selectedPolygons;
        const allVertices = polygons.flatMap(p => p.vertices);
        const reference = (allVertices.find(v => distance(v.vector, center) > 0.001) ?? allVertices[0]).vector;

        const centerToTarget = subtract(worldPos, center);
        const centerToReference = subtract(reference, center);
        const rawAngle = -1 * angleBetween(centerToTarget, centerToReference);
        const snappedAngle = Math.round(rawAngle / ANGLE_SNAP_INCREMENT) * ANGLE_SNAP_INCREMENT;

        // Produce a synthetic target: rotate the reference direction by the snapped angle
        const rotatedRef = rotate(snappedAngle, centerToReference);
        return add(center, rotatedRef);
    };

    // --- Drawing ---

    private drawCenterSelection = () => {
        const polygons = this.selectedPolygons;

        // Draw selected polygon edges dimmed for context
        polygons.forEach(p => {
            p.edges.forEach(e =>
                drawSegment(this.context, e.segment, 'rgba(255, 150, 10, 0.3)')
            );
        });

        // Draw snap targets
        for (const target of this.snapTargets) {
            const isHovered = this.hoveredSnapTarget === target;
            if (target.label === 'center') {
                // Draw center with a crosshair style (larger dot)
                const color = isHovered
                    ? 'rgba(50, 255, 10, 0.9)'
                    : 'rgba(255, 200, 50, 0.7)';
                this.drawCrosshair(target.point, color);
            } else {
                // Draw vertex snap targets
                const color = isHovered
                    ? 'rgba(50, 255, 10, 0.9)'
                    : 'rgba(255, 150, 10, 0.7)';
                drawVector(this.context, target.point, color);
            }
        }

        // Draw mouse cursor position when not snapped
        if (!this.hoveredSnapTarget && this.mousePosition) {
            drawVector(this.context, this.mousePosition, 'rgba(255, 255, 255, 0.5)');
        }
    };

    private drawRotationPreview = () => {
        // Draw rotation center marker
        if (this.rotationCenter) {
            this.drawCrosshair(this.rotationCenter, 'rgba(50, 255, 10, 0.9)');
        }

        // Draw rotated polygon preview
        if (this.candidates.length > 0) {
            this.candidates.forEach(p => {
                p.edges.forEach(e =>
                    drawSegment(this.context, e.segment, 'rgba(255, 150, 10, 0.7)')
                );
                p.vertices.forEach((v, i) =>
                    drawVector(this.context, v.vector,
                        i === 0 ? 'rgba(50, 255, 10, 0.7)' : 'rgba(255, 150, 10, 0.7)')
                );
            });
        }
    };

    private drawCrosshair = (point: Vector, color: string) => {
        const size = 4;
        drawSegment(this.context, [[point[0] - size, point[1]], [point[0] + size, point[1]]], color, 2);
        drawSegment(this.context, [[point[0], point[1] - size], [point[0], point[1] + size]], color, 2);
        drawVector(this.context, point, color);
    };
}
