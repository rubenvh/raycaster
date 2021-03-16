import { ipcRenderer } from "electron";

const template = document.createElement('template');
template.innerHTML = `
<style> 
</style>
<p>Test</p>
<div>    
</div>
`;
/// …

export class MyTestElement extends HTMLElement {
    
    constructor() {
        super();
        // attach Shadow DOM to the parent element.
        // save the shadowRoot in a property because, if you create your shadow DOM in closed mode, 
        // you have no access from outside
        const shadowRoot = this.attachShadow({mode: 'closed'});
        // clone template content nodes to the shadow DOM
        shadowRoot.appendChild(template.content.cloneNode(true));
        const element = shadowRoot.querySelector('div');

        ipcRenderer.on('undo', this.test(element));
    }

    connectedCallback() {
        //...
        this.render();
    }
    
    render() {
        // ...
    } 

    test(element: HTMLDivElement){
        return () => element.innerHTML = new Date().toISOString();
    }
}

window.customElements.define('my-test', MyTestElement);