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
        this.worker = new Worker("../dist/geometry/bsp/worker.js");
        this.worker.postMessage(this.geometry);
        this.worker.onmessage = function(e) {            
            console.log('Message received from worker:', e);
          }
    }
}