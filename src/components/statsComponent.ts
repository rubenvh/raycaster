import { connect } from './../store/store-connector';
import store from "../store";
import { IPerformanceStatistics, IIntersectionStatistics } from "../store/stats";

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<p>Statistics</p>
<div>    
</div>
`;
/// …

export class StatsElement extends HTMLElement {
    
    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));
        const element = shadowRoot.querySelector('div');
        
        connect( state => {
            element.innerHTML = `<ul>
            <li>FPS: ${state.stats.performance.fps}</li>
            ${this.calculateTiming(state.stats.performance.timing)}
            ${this.calculateIntersections(state.stats.intersections)}
            </ul>`;
        });        
    }

    connectedCallback() {     
    }   
    
    calculateTiming(timing: IPerformanceStatistics) {        
        return `<li>Casting: ${this.displayMs(timing.casting, timing.total)}</li>
        <li>ZBuffering: ${this.displayMs(timing.zbuffering, timing.total)}</li>
        <li>Drawing: ${this.displayMs(timing.drawing, timing.total)}</li>`;
    }
    displayMs = (ms: number, total: number) => `${ms.toFixed(0)}ms (${(ms/total*100).toFixed(0)}%)`;

    calculateIntersections(i: IIntersectionStatistics) {        
        
        let t = i.rayIntersectionStats.reduce(
            (acc, cur) => ({
                edgePercentage: Math.max(acc.edgePercentage, cur.edgeCount/cur.amount), 
                max: Math.max(acc.max, cur.amount),
                edgeCount: Math.max(acc.edgeCount, cur.edgeCount)}), 
            {edgePercentage: -Infinity, max: -Infinity, edgeCount: 0 });
        
        return `<li>Max % intersection tests: ${(100*t.edgePercentage).toFixed(2)}</li>
                <li>Max # edges tested: ${t.max.toFixed(0)}</li>
                <li>Total # edges: ${t.edgeCount.toFixed(0)}</li>`;
    }
}

window.customElements.define('render-stats', StatsElement);