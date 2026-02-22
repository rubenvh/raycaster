import { buildBspTree } from '../common/geometry/bsp/creation'
import { IPolygon } from '../common/geometry/polygon';
import { IBSPNode } from '../common/geometry/bsp/model';

/** Message sent TO the worker to request BSP generation. */
export interface BspWorkerRequest {
    polygons: IPolygon[];
    generationId: number;
}

/** Message sent FROM the worker with the completed BSP tree. */
export interface BspWorkerResponse {
    tree: IBSPNode;
    generationId: number;
}

self.addEventListener('message', (e: Event) => {
    const { polygons, generationId } = (<MessageEvent<BspWorkerRequest>>e).data;
    const tree = buildBspTree(polygons);
    const response: BspWorkerResponse = { tree, generationId };
    postMessage(response);
});
