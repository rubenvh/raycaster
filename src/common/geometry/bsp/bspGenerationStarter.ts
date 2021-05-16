import { ipcRenderer } from "electron";
import { connect } from "../../store/store-connector";
import { EMPTY_GEOMETRY, IGeometry } from "../geometry";

export class BspGenerationStarter {
    private worker: Worker|null = null;
    private geometry: IGeometry = EMPTY_GEOMETRY;
    constructor() {         
        ipcRenderer.on('bsp_generate', this.generate);       
        connect(state => {
            this.geometry = state.walls.geometry;
        });
    }
    

    private generate = () =>{     
        if (this.worker) { this.worker.terminate(); }
        this.worker = new Worker("../workers/dist/worker-bundle.js");
        this.worker.postMessage(this.geometry.polygons);
        this.worker.addEventListener('message', (e) => {
            console.log('Finished bsp construction', e);
            // TODO: dispatch updated BSP to redux store
            this.worker?.terminate();
            this.worker = null;
        });
    }
}