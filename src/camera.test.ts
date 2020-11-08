import math = require("mathjs");
import { Vertex } from "./vertex";
import { Camera } from "./camera";

describe('camera tests', () => {
    test('camera init', () => {
      let sut = new Camera(new Vertex(0,0), new Vertex(2, 2));
  
      
      console.dir(sut.screen);
    });
  });
  