import { ipcRenderer } from "electron";
import { useAppDispatch } from "../../store";
import { connect } from "../../store/store-connector";
import { updateBsp } from "../../store/walls";
import { EMPTY_GEOMETRY, IGeometry } from "../geometry";
import { IBSPNode } from "./model";
import { buildBspTree } from './creation'

const dispatch = useAppDispatch();

export class BspGenerationStarter {
    private worker: Worker|null = null;
    private geometry: IGeometry = EMPTY_GEOMETRY;
    constructor() {         
        ipcRenderer.on('bsp_generate', this.generateLocal);       
        connect(state => {
            this.geometry = state.walls.geometry;
        });
    }
    
    private generateLocal = () => {
        const tree = buildBspTree(this.geometry.polygons);
        dispatch(updateBsp(tree))
    }

    private generate = () =>{     
        if (this.worker) { this.worker.terminate(); }
        this.worker = new Worker("../workers/dist/worker-bundle.js");
        this.worker.postMessage(this.geometry.polygons);
        this.worker.addEventListener('message', (e) => {
            console.log('Finished bsp construction', e);            
            const bsp = (<MessageEvent<IBSPNode>>e).data;
            dispatch(updateBsp(bsp))
            this.worker?.terminate();
            this.worker = null;
        });
    }
}