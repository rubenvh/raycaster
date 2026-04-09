## feature: playing a map without editor
- build a separate runnable component that is a stripped down version of the software that does not include map editor features
- only the 3d rendering view is shown
- code should be shared fearlessly
- any new features that will be added later that impact the 3d view will have to work automatically in both executables

## brainstorming list of features
- GENERAL: interactive animation system based on documented plan
- RENDERING: implement floor rendering of polygons (with textures)
- RENDERING: implement ceiling rendering of polygons (with textures)
- RENDERING: implement polygon heights -> 
    - base height: 
        - zero means sea level
        - negative number means polygon is rendered lower with respect to horizon
        - positive number means polygon is rendered higher than horizon
    - wall height
- RENDERING: implement sprites: represent as directed (short) line segments
- RENDERING: implement doors

- RENDERING: luminosity on edge as a function of time to implement flickering 
- RENDERING: implement mirror texture (mirroring surrounding geometry)
- RENDERING: overlay world with a surface of coloured mist gradient. Rays passing this gradient should colour/make fuzzy the geometry behind it. This should replace the fading strategy
- MAPEDITOR: clickable scrollbars
- MENU: disable menu items when not appropriate
- BSP: allow adding hinting split planes drawn by the user