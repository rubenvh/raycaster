import { castCollisionRays } from './../common/raycaster';
import { IRay } from '../common/geometry/collision';
import { IGeometry, EMPTY_GEOMETRY } from './../common/geometry/geometry';

let geometry: IGeometry = EMPTY_GEOMETRY;
self.addEventListener('message', (e: Event) => {    
    const message = (<MessageEvent<IGeometry|IRay[]>> e).data;
    if (!Array.isArray(message)) {        
        // console.log('Received geometry: ', message.polygons.length);    
        geometry = message;        
    } else {        
        // console.log('Casting rays: ', message.length);
        postMessage(castCollisionRays(message, geometry));
    }    
});