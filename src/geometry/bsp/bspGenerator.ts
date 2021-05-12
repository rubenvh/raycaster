import { ipcRenderer } from "electron";
import { connect } from "../../store/store-connector";
import { IGeometry } from "../geometry";

export class BspGenerator {
    worker: Worker;
    geometry: IGeometry;
    constructor() {         
        ipcRenderer.on('bsp_generate', this.calculate);       
        connect(state => {
            this.geometry = state.walls.geometry;
        });
    }
    

    calculate = () =>{     
        if (this.worker) { this.worker.terminate(); }
        this.worker = new Worker("../dist/geometry/bsp/worker.js");
        this.worker.postMessage(this.geometry);
        this.worker.addEventListener('message', (e) => {
            console.log('Message received from worker:', e);
            // TODO: dispatch updated BSP to redux store
            this.worker.terminate();
            this.worker = null;
        });
    }
}