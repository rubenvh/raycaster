const model = require('./model.js');

self.addEventListener('message', (e) => {
    console.log('Message received from main script: ', e);        
    // TODO: start BSP calculation
    const x = {};

    model.test();

    postMessage({bsp: x}, null);
});