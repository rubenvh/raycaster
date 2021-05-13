import { ipcRenderer } from "electron";
import { connect } from "../../store/store-connector";
import { EMPTY_GEOMETRY, IGeometry } from "../geometry";

export class BspGenerator {
    private worker: Worker|null = null;
    private geometry: IGeometry = EMPTY_GEOMETRY;
    constructor() {         
        ipcRenderer.on('bsp_generate', this.calculate);       
        connect(state => {
            this.geometry = state.walls.geometry;
        });
    }
    

    calculate = () =>{     
        if (this.worker) { this.worker.terminate(); }
        this.worker = new Worker("../workers/dist/worker-bundle.js");
        this.worker.postMessage(this.geometry);
        this.worker.addEventListener('message', (e) => {
            console.log('Message received from worker:', e);
            // TODO: dispatch updated BSP to redux store
            this.worker?.terminate();
            this.worker = null;
        });
    }
}