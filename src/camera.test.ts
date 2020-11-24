import * as camera from "./camera";

describe('camera tests', () => {
    test('camera ray creation', () => {
      let sut = camera.makeCamera({position: [0,0], direction: [0, 1], plane: [0,-1]});
      const start = process.hrtime();
      for (let i = 0; i < 1000; i++) {
        camera.makeRays(1280, sut);
      }
      const end = process.hrtime(start);
      //console.log('newcamera', end);
    });   
  });
  