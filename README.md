# Raycaster

An Electron desktop application that combines a 2D geometry editor with a real-time 3D raycasting engine, inspired by classic Wolfenstein 3D / Doom rendering techniques.

![Screenshot showing the 2D editor (top-left) and the 3D rendered view (top-right)](images/current-state.png?raw=true "current state")

The left panel is a 2D top-down editor where you create rooms from vertices (yellow) and edges (white). The right panel renders the geometry in real-time as a simulated 3D environment. The sidebar provides selection trees, property editors, and render statistics.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or 20.x
- npm (included with Node.js)

### Installation

```bash
npm install
```

### Running

```bash
npm start
```

This builds all bundles (webpack) and launches the Electron app.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Build and launch the application |
| `npm run build` | Build all webpack bundles without launching |
| `npm test` | Run the test suite (Jest) |
| `npm run test:benchmark` | Run performance benchmark tests only |

## Application Layout

The application window is divided into four areas:

```
+---------------------+---------------------+
|                     |                     |
|    2D Editor        |    3D Viewport      |
|    (canvas)         |    (canvas)         |
|                     |                     |
+---------------------+---------------------+
|  Selection Tree  |  Property Editor  |
|  Texture Library |  Render Stats     |
+-----------------+-------------------+
```

- **2D Editor** -- Top-down view of the world geometry. Create, select, and manipulate polygons, edges, and vertices.
- **3D Viewport** -- Real-time rendered view from the camera's perspective. Requires a BSP tree for the Z-buffer renderer.
- **Selection Tree** -- Hierarchical view of the current selection (polygons > edges > vertices).
- **Property Editor** -- Context-sensitive panel showing vertex coordinates, edge materials, polygon info, depending on what's selected.
- **Texture Library** -- Import and manage texture images. Assign textures to edges.
- **Render Stats** -- Live performance metrics (FPS, casting time, Z-buffer time, draw time, edge/polygon counts).

## Controls

### Camera Movement

These keys control the camera position in the 3D viewport. Hold keys for continuous movement.

| Key | Action |
|-----|--------|
| `W` | Move camera forward |
| `S` | Move camera backward |
| `A` | Strafe left |
| `D` | Strafe right |
| `Left Arrow` | Rotate camera left |
| `Right Arrow` | Rotate camera right |
| `+ (Numpad)` | Widen field of view |
| `- (Numpad)` | Narrow field of view |
| `Ctrl + (Numpad)` | Increase camera depth |
| `Ctrl - (Numpad)` | Decrease camera depth |

Camera movement includes collision detection with solid (non-immaterial) edges. When close to a wall, the camera slides along it if the approach angle is steep enough; otherwise movement stops.

### Editor Toggles

| Key | Action |
|-----|--------|
| `Tab` | Toggle test canvas visibility |
| `Ctrl+Tab` | Cycle BSP draw mode (off / split planes / detected edges) |

### 2D Editor Mouse Interactions

**Selection:**
- **Left-click** on a vertex, edge, or polygon to select it.
- **Shift+Click** cycles through selection granularity (vertex vs. edge vs. polygon).
- **Ctrl+Click** adds to the current selection (multi-select).
- **Drag on empty space** draws a bounding box to select all elements within the region.

**Moving geometry:**
- **Drag** a selected element to move it.
- **Ctrl+Drag** enables grid snapping while moving.

**Viewport navigation:**
- **Mouse wheel** scrolls the viewport vertically.
- **Shift+Wheel** scrolls horizontally.
- **Ctrl+Wheel** zooms in/out, centered on the cursor.

**Contextual actions** (activated via menu, then use mouse in the editor):
- **Right-click** cancels any active contextual action (polygon creation, edge splitting, etc.).

## Menu Reference

### World

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+N` | New (clear geometry) |
| `Ctrl+Shift+O` | Open a map file |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |

Map files are stored as JSON. Several sample maps are available in `assets/maps/`.

### Textures

| Action | Description |
|--------|-------------|
| Import | Open a PNG/JPG image file as a texture source |
| Library | *(placeholder, not yet implemented)* |

### Geometry -- Polygon Operations

| Shortcut | Action | Requires |
|----------|--------|----------|
| `Ctrl+Space` | Create polygon | Nothing selected. Click to place vertices; close by clicking near the first vertex. |
| `Ctrl+D` | Clone polygon | Polygon(s) selected. Creates a displaced copy. |
| `Ctrl+E` | Expand polygon | One edge selected. Extrudes a new polygon from the selected edge. |
| `Ctrl+Shift+S` | Split polygon | Two vertices selected in the same polygon. Splits the polygon along the line between them. |
| `Ctrl+Shift+R` | Rotate polygon | Polygon(s) selected. Move the mouse to rotate, click to confirm. |
| `Ctrl+Alt+R` | Reverse polygon | Polygon(s) selected. Reverses vertex winding order. |

### Geometry -- Edge Operations

| Shortcut | Action | Requires |
|----------|--------|----------|
| `Ctrl+S` | Split edge | One edge selected. Click on the edge to split it into two. |
| `Ctrl+I` | Toggle immaterial | Edge(s) selected. Toggles passable-but-visible flag. |
| `Ctrl+T` | Toggle texture | Edge(s) selected. Toggles texture on/off. |
| `Ctrl+PageUp` | Next texture | Edge(s) selected. Cycles through available textures. |
| `Ctrl+PageDown` | Previous texture | Edge(s) selected. |
| `Ctrl+]` | Increase translucency | Edge(s) selected. Decreases alpha by 0.1. |
| `Ctrl+[` | Decrease translucency | Edge(s) selected. Increases alpha by 0.1. |

### Geometry -- Other

| Shortcut | Action |
|----------|--------|
| `Ctrl+X` | Remove selected geometry |
| `Ctrl+Shift+F` | Toggle distance-based fading |
| `Ctrl+R` | Recalculate BSP tree |

### Edit

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## BSP Tree

The 3D renderer uses Binary Space Partitioning for efficient rendering. BSP generation is **not automatic** -- you must trigger it manually via `Ctrl+R` or the Geometry menu.

Whenever you modify the geometry (move edges, add polygons, etc.), the existing BSP tree is invalidated and must be recalculated. Without a valid BSP, the Z-buffer renderer will not render.

Press `Ctrl+Tab` to overlay BSP split planes on the 2D editor:

![BSP split planes displayed on the 2D editor](images/bsp-split-planes.png?raw=true "bsp split planes")

![Menu bar item to trigger BSP regeneration](images/generate-bsp.png?raw=true "regenerate bsp")

## Architecture

### Build Targets

The project uses webpack to produce four bundles:

| Target | Entry Point | Output | Description |
|--------|-------------|--------|-------------|
| `electron-main` | `src/main/main.ts` | `src/main/dist/main-bundle.js` | Electron main process (window creation, IPC, file I/O, menus) |
| `electron-preload` | `src/main/preload.ts` | `src/main/dist/preload-bundle.js` | Preload script (secure bridge between main and renderer) |
| `web` | `src/renderer/renderer.ts` | `src/renderer/dist/renderer-bundle.js` | Renderer process (UI, canvas, editor, 3D rendering) |
| `webworker` | `src/workers/bspGenerator.ts`, `src/workers/ray-caster.ts` | `src/workers/dist/` | Web workers for BSP generation and raycasting |

### Source Structure

```
src/
  common/           Shared code used by all targets
    actions/         Editor action handlers (select, move, create, split, etc.)
    camera.ts        Camera model, movement, view frustum, clipping
    datastructures/  Heap (priority queue)
    drawing/         Canvas drawing primitives, wall painter
    editor/          Viewport, grid, scrollbar, map editor
    geometry/        Core geometry types and operations
      bsp/           BSP tree creation, traversal, splitting, classification
      collision.ts   Ray-segment/polygon intersection
      edge.ts        Edge model
      entity.ts      Entity identity system (GUIDs)
      geometry.ts    Geometry container, mutation operations
      polygon.ts     Polygon model, bounding boxes
      properties.ts  Material, color, texture, translucency
      vertex.ts      Vertex model
    math/            Vector, line segment, plane math
    rendering/       
      raycasting/    Traditional column-based raycaster
      zbuffering/    BSP-based Z-buffer renderer
    selection/       Selection model and queries
    store/           Redux state management
    testing/         Test utilities, seeded random, Fishery factories
    textures/        Texture loading and management
  main/              Electron main process
  renderer/          Renderer process
    components/      Custom web components (14 elements)
  workers/           Web workers
```

### Rendering Pipeline

Two rendering approaches are implemented:

**Raycaster** (`src/common/rendering/raycasting/raycaster.ts`): Traditional Wolfenstein-style renderer. Casts one ray per screen column against all geometry. Works with or without BSP (falls back to brute-force polygon intersection). Used for camera collision detection (`castCameraRay`) and visual rendering (`castCollisionRays`).

**Z-Buffer Renderer** (`src/common/rendering/zbuffering/zbuffer-renderer.ts`): BSP-based renderer. Walks the BSP tree front-to-back from the camera position, clips edges to the view frustum, projects visible edges to screen columns, and uses a priority queue per column for correct distance-sorted rendering with transparency support.

Both renderers have pure computational cores (`RaycastCore`, `ZBufferCore`) without DOM or Redux dependencies, used for benchmarking.

### State Management

The application uses Redux Toolkit with custom subscription-based state delivery (not React). Store slices:

| Slice | Purpose |
|-------|---------|
| `walls` | Geometry data, BSP tree, undo/redo history |
| `selection` | Currently selected elements |
| `player` | Camera position and orientation |
| `worldConfig` | Rendering config (fading strategy) |
| `uiConfig` | UI toggles (test canvas, BSP draw mode) |
| `textures` | Loaded texture sources |
| `stats` | Rendering performance statistics |

### Key Concepts

**Edges** have two important boolean properties:
- `immaterial: true` means the edge is **passable but visible** (e.g., waterfall, fog). It still renders, but the camera can walk through it.
- `material == null` means the edge has **no visual representation** and is skipped during rendering (e.g., BSP split edges).

These are distinct concepts. See the `AGENTS.md` file for a full list of non-obvious behaviors and gotchas.

**Directed materials** can be a single material or a `[front, back]` tuple for double-sided edges. Each material has an RGBA color, optional texture, and optional luminosity override. Edge luminosity is computed from the wall angle (vertical walls are brightest at 1.0, horizontal walls darkest at 0.4).

## Testing

The project uses Jest with ts-jest and jsdom. Test data factories use the [Fishery](https://github.com/thoughtbot/fishery) library with a seeded random number generator for reproducible test data.

```bash
# Run all tests
npm test

# Run benchmarks only
npm run test:benchmark
```

### Test Factories

Located in `src/common/testing/factories/`. Available factories:

- `vertexFactory` -- Random vertex positions
- `materialFactory` -- Random RGBA colors
- `edgeFactory` -- Edges with random endpoints and materials (`.opaque()`, `.translucent()`, `.immaterial()`, `.withoutMaterial()`)
- `polygonFactory` -- Polygons from random vertices
- `cameraFactory` -- Cameras with random positions (`.facingNorth()`, `.facingEast()`, `.lookingAt(target)`)
- `geometryFactory` -- Geometry with random polygons (`.withBsp()`, `.singleRectangle()`, `.grid()`)

Always call `resetTestRandom()` in `beforeEach` for deterministic tests.

## CI

GitHub Actions runs the test suite on push and pull requests to `main`, across Node.js 18.x and 20.x on Ubuntu.

## Sample Maps

The `assets/maps/` directory contains 17 JSON map files for testing and experimentation:

`blocks.json`, `blocks2.json`, `blocks3.json`, `bsp-bug.json`, `empty.json`, `generated.json`, `map01.json`, `map02.json`, `maze.json`, `stress-map.json`, `test.json` -- `test7.json`

Load them via `Ctrl+Shift+O` or the World > Open menu.

## Known Issues

See the `TODO` file for the full list. Notable items:

- Completely translucent (invisible) edges are drawn as fading shadows
- BSP is invalidated on any geometry change, even non-physical ones (should only invalidate on structural changes)
- Movement speed is not normalized to FPS
- Selected adjacent polygons have incorrect edge highlight layering

## License

MIT
