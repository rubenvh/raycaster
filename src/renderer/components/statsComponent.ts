import { EMPTY_STATS } from '../../common/rendering/raycasting/raycaster';
import { IStatsState, IBspRenderStats } from '../../common/store/stats';
import { IPerformanceStatistics, IIntersectionStatistics } from "../../common/store/stats";
import { connect } from '../../common/store/store-connector';
import { BspStatus, IBspState } from '../../common/store/bsp-state';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
    :host {
        display: block;
        font-family: monospace;
        font-size: 11px;
        color: #ccc;
        padding: 4px 8px;
        overflow-y: auto;
    }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: rgba(0,0,0,0.9); }
    ::-webkit-scrollbar-thumb { background: rgba(125,125,125,0.7); border-radius: 2px; }
    h3 {
        margin: 0 0 4px 0;
        font-size: 12px;
        color: #eee;
        border-bottom: 1px solid #444;
        padding-bottom: 2px;
        position: sticky;
        top: 0;
        z-index: 1;
        background: #2d2d2d;
    }
    .section {
        margin-bottom: 6px;
    }
    .section-label {
        color: #999;
        font-size: 10px;
        text-transform: uppercase;
        margin-bottom: 2px;
    }
    .row {
        display: flex;
        justify-content: space-between;
        padding: 1px 0;
    }
    .label {
        color: #aaa;
    }
    .value {
        color: #eee;
        text-align: right;
    }
    .value.green { color: #4caf50; }
    .value.yellow { color: #ffb300; }
    .value.red { color: #f44336; }
    .bar {
        display: flex;
        height: 4px;
        margin: 2px 0 4px 0;
        background: #333;
        border-radius: 2px;
        overflow: hidden;
    }
    .bar-segment {
        height: 100%;
    }
    .bar-casting { background: #42a5f5; }
    .bar-zbuffer { background: #ab47bc; }
    .bar-drawing { background: #66bb6a; }
    .bar-background { background: #78909c; }
    .bar-floorceiling { background: #ffa726; }
    .bar-wallrender { background: #66bb6a; }
</style>
<h3>Statistics</h3>
<div id="content"></div>
`;

export default class StatsElement extends HTMLElement {

    private contentEl: HTMLDivElement;
    private _stats: IStatsState;
    private _bspState: IBspState | null = null;
    private unsubscribe: (() => void) | null = null;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRoot.appendChild(template.content.cloneNode(true));
        this.contentEl = shadowRoot.querySelector('#content');
    }

    connectedCallback() {
        this.unsubscribe = connect((state) => {
            this._bspState = state.bsp;
            // Trigger re-render when bsp state changes
            // (stats updates come via the data setter from renderer.ts)
            if (this._stats) {
                this.render();
            }
        });
    }

    disconnectedCallback() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    set data(value) {
        if (value !== this._stats) {
            this._stats = value;
            this.render();
        }
    }

    get data() {
        return this._stats;
    }

    private render() {
        const s = this._stats;
        const bsp = this._bspState;
        let html = '';

        // Performance section
        html += this.renderPerformance(s.performance.fps, s.performance.timing);

        // BSP state section
        if (bsp) {
            html += this.renderBspState(bsp);
        }

        // BSP rendering stats (from zbuffer renderer)
        if (s.bspRendering) {
            html += this.renderBspRendering(s.bspRendering);
        }

        // Intersection stats (from raycaster)
        html += this.renderIntersections(s.intersections);

        this.contentEl.innerHTML = html;
    }

    private renderPerformance(fps: number, timing: IPerformanceStatistics): string {
        const total = timing.total || 1;
        const fpsClass = fps >= 50 ? 'green' : fps >= 30 ? 'yellow' : 'red';
        const hasDetail = timing.wallRendering != null;

        let barHtml: string;
        let rowsHtml: string;

        if (hasDetail) {
            // Detailed breakdown (zbuffer renderer)
            const zbufPct = (timing.zbuffering / total * 100);
            const bgPct = (timing.background / total * 100);
            const fcPct = (timing.floorCeiling / total * 100);
            const wrPct = (timing.wallRendering / total * 100);

            barHtml = `<div class="bar">
                <div class="bar-segment bar-zbuffer" style="width:${zbufPct}%"></div>
                <div class="bar-segment bar-background" style="width:${bgPct}%"></div>
                <div class="bar-segment bar-floorceiling" style="width:${fcPct}%"></div>
                <div class="bar-segment bar-wallrender" style="width:${wrPct}%"></div>
            </div>`;
            rowsHtml = `${this.row('ZBuffer', this.msAndPct(timing.zbuffering, total))}
            ${this.row('Background', this.msAndPct(timing.background, total))}
            ${this.row('Floor/Ceil', this.msAndPct(timing.floorCeiling, total))}
            ${this.row('Walls', this.msAndPct(timing.wallRendering, total))}`;
        } else {
            // Legacy display (raycaster renderer)
            const castPct = (timing.casting / total * 100);
            const zbufPct = (timing.zbuffering / total * 100);
            const drawPct = (timing.drawing / total * 100);

            barHtml = `<div class="bar">
                <div class="bar-segment bar-casting" style="width:${castPct}%"></div>
                <div class="bar-segment bar-zbuffer" style="width:${zbufPct}%"></div>
                <div class="bar-segment bar-drawing" style="width:${drawPct}%"></div>
            </div>`;
            rowsHtml = `${this.row('Casting', this.msAndPct(timing.casting, total))}
            ${this.row('ZBuffer', this.msAndPct(timing.zbuffering, total))}
            ${this.row('Drawing', this.msAndPct(timing.drawing, total))}`;
        }

        return `<div class="section">
            <div class="section-label">Performance</div>
            ${this.row('FPS', `<span class="${fpsClass}">${fps}</span>`)}
            ${this.row('Total', `${total.toFixed(1)}ms`)}
            ${barHtml}
            ${rowsHtml}
        </div>`;
    }

    private renderBspState(bsp: IBspState): string {
        const statusLabel = this.bspStatusLabel(bsp.status);
        const statusClass = this.bspStatusClass(bsp.status);
        const dirty = bsp.dirtyEdges;
        const removed = dirty.removedEdgeIds.size;
        const added = dirty.addedEdgeIds.size;
        const modified = dirty.modifiedEdgeIds.size;

        let html = `<div class="section">
            <div class="section-label">BSP State</div>
            ${this.row('Status', `<span class="${statusClass}">${statusLabel}</span>`)}
            ${this.row('Dirty edges', `<span class="${bsp.dirtyCount > 0 ? 'yellow' : ''}">${bsp.dirtyCount}</span>`)}`;

        if (bsp.dirtyCount > 0) {
            html += `${this.row('  Removed', String(removed))}`;
            html += `${this.row('  Added', String(added))}`;
            html += `${this.row('  Modified', String(modified))}`;
        }

        html += `</div>`;
        return html;
    }

    private renderBspRendering(r: IBspRenderStats): string {
        return `<div class="section">
            <div class="section-label">BSP Rendering</div>
            ${this.row('Edges tested', String(r.edgesTested))}
            ${this.row('Stale skipped', `<span class="${r.staleEdgesSkipped > 0 ? 'yellow' : ''}">${r.staleEdgesSkipped}</span>`)}
            ${this.row('Dirty tested', `<span class="${r.dirtyEdgesTested > 0 ? 'yellow' : ''}">${r.dirtyEdgesTested}</span>`)}
        </div>`;
    }

    private renderIntersections(i: IIntersectionStatistics): string {
        if (i.stats == undefined) return '';
        const t = i.stats;
        if (t.edgeCount === 0 && t.polygonCount === 0) return '';
        return `<div class="section">
            <div class="section-label">Intersections</div>
            ${this.row('Max % tested', `${(100 * t.edgePercentage).toFixed(1)}%`)}
            ${this.row('Edges tested', `[${t.edgeTests[0].toFixed(0)}, ${t.edgeTests[1].toFixed(0)}] / ${t.edgeCount.toFixed(0)}`)}
            ${this.row('Polygons tested', `[${t.polygonTests[0].toFixed(0)}, ${t.polygonTests[1].toFixed(0)}] / ${t.polygonCount.toFixed(0)}`)}
        </div>`;
    }

    private row(label: string, value: string): string {
        return `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
    }

    private msAndPct(ms: number, total: number): string {
        return `${ms.toFixed(1)}ms (${(ms / total * 100).toFixed(0)}%)`;
    }

    private bspStatusLabel(status: BspStatus): string {
        switch (status) {
            case 'fresh': return 'Fresh';
            case 'stale': return 'Stale';
            case 'rebuilding': return 'Rebuilding';
            case 'none': return 'None';
            default: return status;
        }
    }

    private bspStatusClass(status: BspStatus): string {
        switch (status) {
            case 'fresh': return 'green';
            case 'stale': return 'yellow';
            case 'rebuilding': return 'yellow';
            case 'none': return 'red';
            default: return '';
        }
    }
}

window.customElements.define('render-stats', StatsElement);