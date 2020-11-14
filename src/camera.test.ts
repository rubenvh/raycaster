import math = require("mathjs");
import { Camera } from "./camera";

describe('camera tests', () => {
    test('camera init', () => {
      let sut = new Camera([0,0], [2, 2]);        
      console.dir(sut.screen);
    });
  });
  