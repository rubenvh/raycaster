# electron raycaster experiments

In this codebase we are exploring electron, javascript/typescript, ngrx and some other technologies to add to our knowledge portfolio.

The plan is to use these technologies to build a 2D top view geometry editor and a corresponding 3D view generated using raycasting.

Eventually we want to include wall rendering, texture mapping, floors and ceilings, sprites, dynamic geometry (moving walls, doors etc)

We just started development and the current state of the project shows that we still have a long journey ahead of us:

![image showing the current state of the project](images/current-state.png?raw=true "current state")

- The image shows the 2D top view containing a camera object and a square room
- the room consists of vertices (yellow) and edges (white)
- The UI is listening to the following keys to change the camera position:

| Key combination |      Action      |
|-----------------|-------------|
| W               |move camera forward | 
| S               |move camera backward | 
| A               |strafe left | 
| D               |strafe right | 
| Left            |rotate camera left | 
| Right           |rotate camera right | 
| +               |increase field of vision | 
| -               |decrease field of vision | 
| Control/+       |increase camera depth | 
| Control/-       |decrease camera depth | 



