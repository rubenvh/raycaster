import { snap, Vector, distance } from '../math/vector';
import { drawSegment, drawVector } from '../drawing/drawing';
import { IActionHandler } from './actions';
import { ISpaceTranslator } from './geometrySelector';
import { connect } from '../store/store-connector';
import { useAppDispatch } from '../store';
import * as actions from '../store/walls';
import { SelectableElement } from '../selection/selectable';

/// <reference path="../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class PolygonGenerator implements IActionHandler {
    private isGenerating: boolean = false;
    private center: Vector | null = null;
    private currentRadius: number = 0;
    private sides: number = 6;
    private currentMouse: Vector | null = null;
    private selectedElements: SelectableElement[] = [];
    private unsubscribe: () => void;
    private registeredElement: GlobalEventHandlers | null = null;

    constructor(
        private context: CanvasRenderingContext2D,
        private spaceTranslator: ISpaceTranslator) {
            this.unsubscribe = connect(s => {
                this.selectedElements = s.selection.elements;
            });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.registeredElement = g;
        window.electronAPI.on('geometry_polygon_generate', this.startGeneration);
        window.electronAPI.on('geometry_polygon_generate_sides', this.setSides);
        g.addEventListener('mousemove', this.trackMouse);
        g.addEventListener('mousedown', this.setCenter);
        g.addEventListener('mouseup', this.finalize);
        g.addEventListener('contextmenu', this.cancel, false);
        window.addEventListener('wheel', this.adjustSides, true);
        window.addEventListener('keydown', this.handleKeyDown, false);
        return this;
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('geometry_polygon_generate', this.startGeneration);
        window.electronAPI.off('geometry_polygon_generate_sides', this.setSides);
        window.removeEventListener('wheel', this.adjustSides, true);
        window.removeEventListener('keydown', this.handleKeyDown, false);
        if (this.registeredElement) {
            this.registeredElement.removeEventListener('mousemove', this.trackMouse);
            this.registeredElement.removeEventListener('mousedown', this.setCenter);
            this.registeredElement.removeEventListener('mouseup', this.finalize);
            this.registeredElement.removeEventListener('contextmenu', this.cancel, false);
        }
    }

    handle(_deltaTime: number): void {
        if (!this.isActive()) return;

        if (this.center && this.currentRadius > 0) {
            // Draw preview of the regular polygon
            const vertices = this.computePreviewVertices();
            for (let i = 0; i < vertices.length; i++) {
                const next = vertices[(i + 1) % vertices.length];
                drawSegment(this.context, [vertices[i], next], 'rgba(100, 200, 255, 0.7)');
                drawVector(this.context, vertices[i], 'rgba(100, 200, 255, 0.7)');
            }
            // Draw center point
            drawVector(this.context, this.center, 'rgba(255, 255, 100, 0.9)');
            // Draw side count label near center
            this.drawSideCountLabel(this.center);
        } else if (this.currentMouse) {
            // Just draw the cursor position before center is placed
            drawVector(this.context, this.currentMouse, 'rgba(100, 200, 255, 0.5)');
            // Draw side count label near cursor
            this.drawSideCountLabel(this.currentMouse);
        }
    }

    public isActive = () => this.isGenerating;

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isGenerating) {
            this.cancel();
        }
    };

    private startGeneration = () => {
        if (this.selectedElements.length > 0) return;
        this.isGenerating = true;
        this.center = null;
        this.currentRadius = 0;
    };

    private setSides = (count: number) => {
        if (count >= 3 && count <= 32) {
            this.sides = count;
        }
    };

    private adjustSides = (event: WheelEvent) => {
        if (!this.isGenerating) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const delta = event.deltaY < 0 ? 1 : -1;
        const newSides = this.sides + delta;
        if (newSides >= 3 && newSides <= 32) {
            this.sides = newSides;
        }
    };

    private cancel = () => {
        this.isGenerating = false;
        this.center = null;
        this.currentRadius = 0;
        this.currentMouse = null;
    };

    private trackMouse = (event: MouseEvent): boolean => {
        if (!this.isActive()) return false;
        const v = this.spaceTranslator.toWorldSpace(event);
        const pos = event.ctrlKey ? snap(v) : v;
        this.currentMouse = pos;

        if (this.center) {
            this.currentRadius = distance(this.center, pos);
        }
        return true;
    };

    private setCenter = (event: MouseEvent): boolean => {
        if (event.button !== 0) return false;
        if (!this.isActive()) return false;
        if (this.center) return false; // Center already set, waiting for release

        const v = this.spaceTranslator.toWorldSpace(event);
        this.center = event.ctrlKey ? snap(v) : v;
        this.currentRadius = 0;
        return true;
    };

    private finalize = (event: MouseEvent): boolean => {
        if (event.button !== 0) return false;
        if (!this.isActive()) return false;
        if (!this.center) return false;

        event.stopImmediatePropagation();

        if (this.currentRadius > 2) {
            dispatch(actions.createRegularPolygon({
                center: this.center,
                radius: this.currentRadius,
                sides: this.sides
            }));
        }
        this.cancel();
        return true;
    };

    private computePreviewVertices(): Vector[] {
        const vertices: Vector[] = [];
        for (let i = 0; i < this.sides; i++) {
            const angle = (2 * Math.PI * i / this.sides) - Math.PI / 2;
            vertices.push([
                this.center[0] + this.currentRadius * Math.cos(angle),
                this.center[1] + this.currentRadius * Math.sin(angle),
            ]);
        }
        return vertices;
    }

    private drawSideCountLabel(position: Vector): void {
        const ctx = this.context;
        const label = `${this.sides} sides`;
        ctx.save();
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        const x = position[0] + 8;
        const y = position[1] - 8;
        ctx.strokeText(label, x, y);
        ctx.fillText(label, x, y);
        ctx.restore();
    }
}
