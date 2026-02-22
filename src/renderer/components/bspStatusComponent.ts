import { connect } from '../../common/store/store-connector';
import { BspStatus } from '../../common/store/bsp-state';

const template = document.createElement('template');
template.innerHTML = /*html*/`
<style>
    :host {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-family: monospace;
        color: #ccc;
        padding: 0 8px;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .dot.green  { background: #4caf50; }
    .dot.yellow { background: #ffb300; }
    .dot.red    { background: #f44336; }
    .dot.yellow-pulse {
        background: #ffb300;
        animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
</style>
<span class="dot"></span>
<span class="label"></span>
`;

type DotClass = 'green' | 'yellow' | 'yellow-pulse' | 'red';

export default class BspStatusComponent extends HTMLElement {
    private dot: HTMLSpanElement;
    private label: HTMLSpanElement;
    private unsubscribe: (() => void) | null = null;
    private currentDotClass: DotClass | null = null;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: 'closed' });
        shadowRoot.appendChild(template.content.cloneNode(true));
        this.dot = shadowRoot.querySelector('.dot')!;
        this.label = shadowRoot.querySelector('.label')!;
    }

    connectedCallback() {
        this.unsubscribe = connect((state) => {
            const { status, treeHolder, dirtyCount } = state.bsp;
            this.update(status, treeHolder != null, dirtyCount);
        });
    }

    disconnectedCallback() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    private update(status: BspStatus, hasTree: boolean, dirtyCount: number) {
        let dotClass: DotClass;
        let labelText: string;

        switch (status) {
            case 'fresh':
                dotClass = 'green';
                labelText = 'BSP';
                break;
            case 'stale':
                dotClass = 'yellow';
                labelText = `BSP stale (${dirtyCount})`;
                break;
            case 'rebuilding':
                dotClass = 'yellow-pulse';
                labelText = 'BSP regenerating...';
                break;
            case 'none':
            default:
                dotClass = 'red';
                labelText = hasTree ? 'BSP' : 'No BSP';
                break;
        }

        if (this.currentDotClass !== dotClass) {
            if (this.currentDotClass) {
                this.dot.classList.remove(this.currentDotClass);
            }
            this.dot.classList.add(dotClass);
            this.currentDotClass = dotClass;
        }
        this.label.textContent = labelText;
    }
}

window.customElements.define('bsp-status', BspStatusComponent);
