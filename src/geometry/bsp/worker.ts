self.addEventListener('message', (e) => {
    //console.log('Message received from main script: ', e);        
    // TODO: start BSP calculation
    
    postMessage({bsp: {}}, null);
});