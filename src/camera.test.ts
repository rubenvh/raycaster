import { makeCamera } from "./camera";

describe('camera tests', () => {
    test('camera init', () => {
      let sut = makeCamera({location: [0,0], target: [2, 2]});        
      console.dir(sut.screen);
    });
  });
  