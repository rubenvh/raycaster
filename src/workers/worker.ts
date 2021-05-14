import { test, IBSPNode } from '../common/geometry/bsp/model'

self.addEventListener('message', (e: Event) => {
    console.log('Message received from main script: ', e);        
    // TODO: start BSP calculation
    const x: IBSPNode = {};

    test();

    postMessage({bsp: x});
});