# re-enactments of old graphics technologies

This project is an experiment on implementing a geometry editor and engine to convert a 2D geometry into a simple 3D world. 

![image showing the current state of the project](images/current-state.png?raw=true "current state")

- The image shows a screenshot of the current state of the project.
- On the top left you can see the 2D top view containing a camera object and a couple of connected spaces/rooms
- the rooms consist of vertices (yellow) and edges (white)
- The top right shows the resulting generated simulation of a 3D environment.

## starting the program

1. Install all dependencies (run these commands from the root folder of the project)
> npm install

2. Startup:
> npm start

When the application is loaded, you can start creating your geometry. You can find some convenient shortcuts via the menu bar.
Instead, you can load some of the json map files available inside the assets/maps folder.

## changing the camera position
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
| Control +       |increase camera depth | 
| Control -       |decrease camera depth | 

## speeding up performance

We are using a Binary Space Partitioning (BSP) to enhance performance of the rendering process. 
Note that BSP (re)generation is not yet automated. You can trigger it manually using the menu bar:

![image showing the menu bar item to trigger regeneration of the BSP](images/generate-bsp.png?raw=true "regenerate bsp")