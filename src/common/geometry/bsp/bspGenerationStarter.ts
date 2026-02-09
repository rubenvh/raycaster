import { useAppDispatch } from "../../store";
import { connect } from "../../store/store-connector";
import { updateBsp } from "../../store/walls";
import { EMPTY_GEOMETRY, IGeometry } from "../geometry";
import { IBSPNode } from "./model";
import { buildBspTree } from './creation'

/// <reference path="../../../renderer/electron.d.ts" />

const dispatch = useAppDispatch();

export class BspGenerationStarter {
    private worker: Worker|null = null;
    private geometry: IGeometry = EMPTY_GEOMETRY;
    private unsubscribe: () => void;
    private workerMessageHandler: ((e: MessageEvent) => void) | null = null;

    constructor() {         
        window.electronAPI.on('bsp_generate', this.generateLocal);       
        this.unsubscribe = connect(state => {
            this.geometry = state.walls.geometry;
        });
    }

    dispose(): void {
        this.unsubscribe();
        window.electronAPI.off('bsp_generate', this.generateLocal);
        this.terminateWorker();
    }

    private terminateWorker(): void {
        if (this.worker) {
            if (this.workerMessageHandler) {
                this.worker.removeEventListener('message', this.workerMessageHandler);
                this.workerMessageHandler = null;
            }
            this.worker.terminate();
            this.worker = null;
        }
    }
    
    private generateLocal = () => {
        const tree = buildBspTree(this.geometry.polygons);
        dispatch(updateBsp(tree))
    }

    // TODO: this can be used for web worker based bsp generation (for now not needed)
    private generate = () =>{     
        this.terminateWorker();
        this.worker = new Worker("../workers/dist/bspGenerator-bundle.js");
        this.worker.postMessage(this.geometry.polygons);
        this.workerMessageHandler = (e: MessageEvent) => {
            console.log('Finished bsp construction', e);            
            const bsp = (<MessageEvent<IBSPNode>>e).data;
            dispatch(updateBsp(bsp))
            this.terminateWorker();
        };
        this.worker.addEventListener('message', this.workerMessageHandler);
    }
}