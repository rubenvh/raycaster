import store from "../store";
import { IPerformanceStatistics, IIntersectionStatistics } from "../store/stats";

//const { stats }: any = useSelector<RootState>(_=>_.stats);
const template = document.createElement('template');
template.innerHTML = `
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
        
        store.subscribe(() => {
            const state = store.getState().stats;

            element.innerHTML = `<ul>
                <li>FPS: ${state.performance.fps}</li>
                ${this.calculateTiming(state.performance.timing)}
                ${this.calculateIntersections(state.intersections)}
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
                edgePercentage: Math.max(acc.edgePercentage, cur.percentage), 
                max: Math.max(acc.max, cur.amount)}), 
            {edgePercentage: -Infinity, max: -Infinity, });
        
        return `<li>Max % intersection tests: ${t.edgePercentage.toFixed(1)}</li>
                <li>Max # edges tested: ${t.max.toFixed(0)}</li>`;
    }
}

window.customElements.define('render-stats', StatsElement);


