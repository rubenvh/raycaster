import math = require("mathjs");
import { OldVector } from "./vector";
import { Camera } from "./camera";

describe('camera tests', () => {
    test('camera init', () => {
      let sut = new Camera(new OldVector(0,0), new OldVector(2, 2));
  
      
      console.dir(sut.screen);
    });
  });
  