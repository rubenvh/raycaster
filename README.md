# electron raycaster experiments

In this project we are implementing an engine to convert a 2D geometry into a simple 3D world where all walls have the same height. We are deviating from the standard raycasting implementations where all walls are square blocks. This means that we cannot benefit from some of the performance improvements on which a game like wolfenstein 3D was based. But the advantage is that we can have a general 2D geometry with walls of any angle.

Eventually we want to include wall rendering, texture mapping, floors and ceilings, sprites, dynamic geometry (moving walls, doors etc).

We just started development and the current state of the project shows that we still have a long journey ahead of us:

![image showing the current state of the project](images/current-state.png?raw=true "current state")

- The image shows a screenshot of the current state of the project.
- On the left you can see the 2D top view containing a camera object and a square room
- the room consists of vertices (yellow) and edges (white)
- On the right you can see the resulting 3D generated environment.
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



