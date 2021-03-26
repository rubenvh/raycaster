import { ipcRenderer } from "electron";
import { IpcRendererEvent } from "electron/main";

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

        ipcRenderer.on('renderStats', this.test(element));
    }

    connectedCallback() {
        //...
        this.render();
    }
    
    render() {
        // ...
    } 

    test(element: HTMLDivElement){
        return (event: IpcRendererEvent, ...args: any[]) => element.innerHTML = JSON.stringify(args);
    }
}

window.customElements.define('my-test', MyTestElement);