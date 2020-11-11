import math = require("mathjs");
import { Vector } from "./vector";
import { Camera } from "./camera";

describe('camera tests', () => {
    test('camera init', () => {
      let sut = new Camera(new Vector(0,0), new Vector(2, 2));
  
      
      console.dir(sut.screen);
    });
  });
  