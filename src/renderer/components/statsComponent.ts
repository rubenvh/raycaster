import { EMPTY_STATS } from './../../common/raycaster';
import { IStatsState } from '../../common/store/stats';
import { IPerformanceStatistics, IIntersectionStatistics } from "../../common/store/stats";

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<p>Statistics</p>
<div>    
</div>
`;
/// …

export default class StatsElement extends HTMLElement {
    
    private element: HTMLDivElement;
    private _stats: IStatsState;

    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));
        
        this.element = shadowRoot.querySelector('div');
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
        this.element.innerHTML = `<ul>
        <li>FPS: ${this._stats.performance.fps}</li>
        ${this.calculateTiming(this._stats.performance.timing)}
        ${this.calculateIntersections(this._stats.intersections)}
        </ul>`;
    }
    private calculateTiming(timing: IPerformanceStatistics) {        
        return `<li>Casting: ${this.displayMs(timing.casting, timing.total)}</li>
        <li>ZBuffering: ${this.displayMs(timing.zbuffering, timing.total)}</li>
        <li>Drawing: ${this.displayMs(timing.drawing, timing.total)}</li>`;
    }
    private displayMs = (ms: number, total: number) => `${ms.toFixed(0)}ms (${(ms/total*100).toFixed(0)}%)`;

    private calculateIntersections(i: IIntersectionStatistics) {        
        
        let t = i.stats;        
        return `<li>Max % intersection tests: ${(100*t.edgePercentage).toFixed(2)}</li>
                <li>Min/Max edges tested: [${t.edgeTests[0].toFixed(0)},${t.edgeTests[1].toFixed(0)}] (of ${t.edgeCount.toFixed(0)})</li>                
                <li>Min/Max polygons tested: [${t.polygonTests[0].toFixed(0)},${t.polygonTests[1].toFixed(0)}] (of ${t.polygonCount.toFixed(0)})</li>`;
    }
}

window.customElements.define('render-stats', StatsElement);