import { buildBspTree } from '../common/geometry/bsp/creation'
import { IPolygon } from '../common/geometry/polygon';

self.addEventListener('message', (e: Event) => {
    console.log('Starting bsp construction: ', e);    
    const polygons = (<MessageEvent<Array<IPolygon>>> e).data;
    const tree = buildBspTree(polygons);
    postMessage(tree);
});