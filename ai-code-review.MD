# AI Code Review: Raycaster Project

**Review Date:** February 9, 2026 (Updated)  
**Original Review:** February 6, 2026  
**Reviewed By:** AI Code Analyzer  
**Repository:** https://github.com/rubenvh/raycaster  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Recent Changes Summary](#2-recent-changes-summary)
3. [Purpose & Overview](#3-purpose--overview)
4. [Technology Stack](#4-technology-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Source Code Organization](#6-source-code-organization)
7. [File-by-File Breakdown](#7-file-by-file-breakdown)
8. [Key Components Deep Dive](#8-key-components-deep-dive)
9. [Data Flow](#9-data-flow)
10. [Points for Improvement](#10-points-for-improvement)
    - [10.1 Resolved Issues](#101-resolved-issues)
    - [10.2 Remaining Code Quality Issues](#102-remaining-code-quality-issues)
    - [10.3 Performance Improvements](#103-performance-improvements-with-code-samples)
    - [10.4 Test Coverage Gaps](#104-test-coverage-gaps)
    - [10.5 Technical Debt](#105-technical-debt)
    - [10.6 Architectural Improvements](#106-architectural-improvements)
11. [Dependency Audit](#11-dependency-audit)
12. [Priority Action Items](#12-priority-action-items-checklist)
13. [Summary of Recommendations](#13-summary-of-recommendations)

---

## 1. Executive Summary

This codebase implements a **2D geometry editor and raycasting engine** built with Electron and TypeScript. The application recreates classic graphics technology (similar to Wolfenstein 3D/Doom) by converting 2D polygon-based maps into a pseudo-3D first-person perspective using raycasting techniques.

### Strengths
- Well-organized modular architecture with clear separation of concerns
- Two rendering strategies (traditional raycasting and BSP-optimized)
- Full Binary Space Partitioning (BSP) implementation for performance
- Redux-based state management with undo/redo support
- Comprehensive 2D math library
- **✅ Proper Electron security with context isolation (recently fixed)**
- **✅ Secure IPC communication via preload script (recently added)**
- **✅ Error handling for file operations (recently added)**

### Areas Requiring Attention (Updated)
- ~~**Critical:** Outdated Electron version with security vulnerabilities~~ **✅ RESOLVED**
- ~~**Critical:** Context isolation disabled~~ **✅ RESOLVED**  
- ~~**High:** Missing error handling for file operations~~ **✅ RESOLVED**
- **High:** Memory leaks from unremoved event listeners
- **Medium:** Code duplication, low test coverage
- **Low:** Performance optimizations, documentation gaps

### Recent Improvements (Feb 6-9, 2026)
- Upgraded Electron from v13.1.6 to v28.1.0
- Implemented secure context isolation with preload script
- Added comprehensive error handling for file I/O operations
- Fixed critical BSP renderer bug causing walls to not render
- Improved ZBuffer performance with PriorityDeque
- Updated TypeScript to v5.3.3

---

## 2. Recent Changes Summary

This section documents the significant changes made between February 6-9, 2026.

### 2.1 Security Overhaul - Electron Upgrade & Context Isolation

**Commits:** `9e00541`, `f4d8c28`

The most critical change addresses the security vulnerabilities identified in the original review:

| Change | Before | After |
|--------|--------|-------|
| Electron Version | 13.1.6 (EOL, vulnerable) | 28.1.0 (current, supported) |
| Context Isolation | `false` (insecure) | `true` (secure) |
| Node Integration | `true` (full Node.js access) | `false` (sandboxed) |
| Remote Module | `true` (deprecated) | Removed |

**New Architecture:**
- Added `src/main/preload.ts` - secure IPC bridge using `contextBridge`
- Added `src/renderer/electron.d.ts` - TypeScript definitions for exposed APIs
- All file operations now use IPC invoke/handle pattern

**Secure API Exposure:**
```typescript
// src/main/preload.ts - Only whitelisted channels are exposed
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  // ... other safe operations
});
```

### 2.2 Error Handling Implementation

**File:** `src/common/storage/stateLoader.ts`

The file operations that previously had no error handling now include:

| Operation | Error Handling |
|-----------|----------------|
| `loadFile()` | try-catch with user error dialog |
| `saveFile()` | try-catch with user error dialog |
| `importTexture()` | try-catch with user error dialog |

```typescript
// Example: loadFile now properly handles errors
private loadFile = async (filePath: string): Promise<void> => {
    try {
        const data = await window.electronAPI.readFile(filePath);
        const content = new TextDecoder().decode(data);
        this.loadWorld(JSON.parse(content));
        // ...
    } catch (error) {
        console.error('Failed to load file:', error);
        this.showError('Load File Failed', `Could not load world from: ${filePath}`);
        localStorage.removeItem('loadedFile');
    }
};
```

### 2.3 BSP Renderer Bug Fix

**Commit:** `9e00541`  
**Documentation:** `docs/BSP_RENDERER_BUG_FIX.md`

A critical bug was fixed where walls would randomly not render from certain camera positions.

**Root Cause:** The renderer incorrectly assumed that BSP tree traversal order equals distance order. It used early termination when the Z-buffer was "full", but coplanar edges in BSP can be at any distance from the camera.

**Fix:** Removed early termination - all edges are now processed and the ZBuffer's PriorityDeque sorts them by actual distance.

```typescript
// Before (buggy): Early exit when buffer full
if (buffer.isFull()) return false;

// After (fixed): Always process all edges
// Note: removed early termination based on buffer.isFull()
return true;  // Always continue traversing
```

### 2.4 ZBuffer Performance Improvements

**Commits:** `ca38ca1`, `e4158a7`, `78c22ef`

- Introduced `PriorityDeque` from `priority-deque` library for efficient sorting
- Replaced custom Heap implementation with optimized deque
- Improved wall grouping algorithm for batch rendering

### 2.5 TypeScript & Dependency Updates

**Commit:** `f4d8c28`

| Package | Old Version | New Version |
|---------|-------------|-------------|
| TypeScript | 4.3.5 | 5.3.3 |
| @types/node | 16.3.1 | 20.10.6 |
| Electron | 13.1.6 | 28.1.0 |

---

## 3. Purpose & Overview

### What This Project Does

1. **2D Geometry Editor** - Create and edit polygon-based maps (rooms, corridors, spaces) with vertices and edges
2. **3D Raycasting Renderer** - Convert 2D geometry into a simulated 3D first-person view
3. **Navigation** - Move through the 3D world using WASD controls

### User Features

| Feature | Description |
|---------|-------------|
| Map Creation | Create polygons, vertices, edges with textures and materials |
| Visual Editing | Interactive 2D top-down view for geometry manipulation |
| 3D Preview | Real-time pseudo-3D rendering of the map |
| BSP Optimization | Manual BSP tree generation for improved rendering performance |
| File I/O | Load/save maps as JSON files |
| Texture Support | Apply textures to wall surfaces |

### Controls

| Key | Action |
|-----|--------|
| W/S | Move forward/backward |
| A/D | Strafe left/right |
| Left/Right Arrow | Rotate camera |
| +/- | Adjust field of vision |
| Ctrl++/- | Adjust camera depth |
| Tab | Toggle test canvas |
| Ctrl+Tab | Toggle BSP visualization |

---

## 4. Technology Stack

| Category | Technology | Version | Current Latest | Status |
|----------|------------|---------|----------------|--------|
| Runtime | Electron | 28.1.0 | 28.x | **✅ Current** |
| Language | TypeScript | 5.3.3 | 5.x | **✅ Current** |
| Build Tool | Webpack | 5.44.0 | 5.x | Minor updates available |
| State Management | Redux Toolkit | 1.6.0 | 2.x | Major version behind |
| Testing | Jest | 27.0.6 | 29.x | Major version behind |
| Unique ID | guid-typescript | 1.0.9 | 1.0.9 | Current |
| Image Processing | image-size | 1.0.0 | 1.x | Current |
| Data Structures | priority-deque | 1.0.4 | 1.0.4 | Current |

---

## 5. Architecture Overview

### High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                         ELECTRON APPLICATION                             |
+-------------------------------------------------------------------------+
|  +------------------+                       +---------------------------+ |
|  |   Main Process   |                       |     Renderer Process      | |
|  |   (main.ts)      |                       |     (renderer.ts)         | |
|  |                  |                       |                           | |
|  | - Window mgmt    |     IPC Invoke/       | - Game loop               | |
|  | - File dialogs   | <------------------> | - UI rendering            | |
|  | - Menu system    |        Handle         | - Input handling          | |
|  | - FS operations  |                       |                           | |
|  +--------+---------+                       +-------------+-------------+ |
|           |                                               |               |
|           | contextBridge                                 |               |
|           v                                               |               |
|  +------------------+                                     |               |
|  |  Preload Script  |  window.electronAPI                 |               |
|  |  (preload.ts)    | ---------------------------------->|               |
|  | - Secure IPC     |  (whitelisted channels only)        |               |
|  | - Channel filter |                                     |               |
|  +------------------+                                     |               |
+------------------------------------|-------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            Redux Store                                   |
|  +--------+ +--------+ +-----------+ +----------+ +-------+ +--------+  |
|  | walls  | | player | | selection | | textures | | stats | |uiConfig|  |
|  |(geom+  | |(camera)| |           | |          | |       | |        |  |
|  |history)|         | |           | |          | |       | |        |  |
|  +--------+ +--------+ +-----------+ +----------+ +-------+ +--------+  |
+-------------------------------------------------------------------------+
                    ^                              |
                    |       store-connector        v
+-------------------+---------------+  +--------------------------+
|        Action Handlers            |  |   Rendering Pipeline     |
|                                   |  |                          |
| - Camera/Movement (WASD)          |  | +----------+ +--------+  |
| - Geometry CRUD                   |  | |Renderer3d| |ZBuffer |  |
| - Selection                       |  | |(raycasting| |Renderer|  |
| - Undo/Redo                       |  | +----------+ +--------+  |
+-----------------------------------+  +--------------------------+
                                                  |
                                                  v
                                       +-------------------+
                                       |  Canvas Drawing   |
                                       |  (2D & 3D views)  |
                                       +-------------------+
```

### Multi-Process Architecture

| Process | Entry Point | Responsibilities |
|---------|-------------|------------------|
| **Main Process** | `src/main/main.ts` | Window management, file dialogs, application menu, IPC handling, FS operations |
| **Preload Script** | `src/main/preload.ts` | Secure IPC bridge via `contextBridge`, channel whitelisting |
| **Renderer Process** | `src/renderer/renderer.ts` | Game loop, UI rendering, input handling, Redux store |
| **Web Workers** | `src/workers/*.ts` | Parallel BSP generation, raycasting (experimental) |

### Security Model (Context Isolation)

The application now uses Electron's recommended security model:

```typescript
// main.ts - Secure window configuration
mainWindow = new BrowserWindow({
    webPreferences: {
        nodeIntegration: false,      // No direct Node.js access
        contextIsolation: true,      // Isolated renderer context
        preload: preloadPath,        // Only preload has Node access
    }
});
```

```typescript
// preload.ts - Whitelisted channel exposure
const validReceiveChannels = [
    'openFile', 'saveFileAs', 'saveFile', 'newFile',
    'undo', 'redo', 'bsp_generate', 'bsp_cancel',
    // ... geometry operations
];

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, data) => ipcRenderer.invoke('fs:writeFile', path, data),
    on: (channel, callback) => {
        if (validReceiveChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
        }
    },
    // ... other safe operations
});
```

### Rendering Strategy

The application uses **two mutually exclusive rendering strategies**:

1. **Renderer3d** (Traditional Raycasting)
   - Active when NO BSP tree exists
   - Casts rays for each screen column
   - Tests intersections against all geometry
   - Simple but slower for complex scenes

2. **ZBufferRenderer** (BSP-Optimized)
   - Active when BSP tree EXISTS
   - Walks BSP tree front-to-back
   - Only renders visible geometry
   - More efficient for complex scenes

---

## 6. Source Code Organization

```
src/
├── main/                     # Electron main process
│   ├── main.ts              # Entry point, window creation, IPC handlers
│   ├── preload.ts           # Secure IPC bridge (contextBridge)
│   ├── mainmenu.ts          # Application menu configuration
│   ├── dialogs.ts           # File open/save dialogs
│   └── tsconfig.json        # TypeScript config (strict: true)
│
├── renderer/                 # Electron renderer process
│   ├── renderer.ts          # Main loop, initialization
│   ├── index.html           # HTML entry point
│   ├── electron.d.ts        # TypeScript definitions for electronAPI
│   ├── testCanvas.ts        # Debug canvas utilities
│   ├── tsconfig.json        # TypeScript config
│   └── components/          # UI Web Components (18 files)
│       ├── index.ts         # Component registration
│       └── ...              # Individual components
│
├── workers/                  # Web Workers for parallel processing
│   ├── bspGenerator.ts      # BSP tree construction worker
│   ├── ray-caster.ts        # Parallel raycasting worker (experimental)
│   └── tsconfig.json        # TypeScript config (strict: false)
│
├── common/                   # Shared application logic
│   ├── camera.ts            # Camera implementation
│   ├── stateModel.ts        # State model types
│   │
│   ├── geometry/            # Core geometry types
│   │   ├── geometry.ts      # Geometry operations
│   │   ├── polygon.ts       # Polygon data structure
│   │   ├── edge.ts          # Edge data structure
│   │   ├── vertex.ts        # Vertex data structure
│   │   ├── entity.ts        # GUID-based entity identity
│   │   ├── properties.ts    # Material system
│   │   ├── collision.ts     # Collision detection
│   │   └── bsp/             # Binary Space Partitioning
│   │       ├── model.ts     # BSP node types
│   │       ├── creation.ts  # Tree construction
│   │       ├── querying.ts  # Tree traversal
│   │       ├── splitting.ts # Polygon splitting
│   │       └── ...          # Classification, strategies
│   │
│   ├── rendering/           # 3D rendering engines
│   │   ├── renderer.ts      # IRenderer interface
│   │   ├── raycasting/      # Traditional raycaster
│   │   │   ├── renderer3d.ts
│   │   │   └── raycaster.ts
│   │   ├── zbuffering/      # BSP-optimized renderer
│   │   │   └── zbuffer-renderer.ts
│   │   └── bspwalking/      # BSP traversal utilities
│   │       └── walker.ts
│   │
│   ├── editor/              # 2D map editor
│   │   ├── mapEditor.ts     # Editor renderer
│   │   ├── viewport.ts      # Viewport/scroll handling
│   │   ├── scrollBar.ts     # Scroll bar component
│   │   ├── grid.ts          # Grid rendering
│   │   └── colors.ts        # Color constants
│   │
│   ├── store/               # Redux state management
│   │   ├── index.ts         # Store configuration
│   │   ├── store-connector.ts # Pub/sub connector
│   │   ├── walls.ts         # Geometry + undo history
│   │   ├── player.ts        # Camera state
│   │   ├── selection.ts     # Selection state
│   │   ├── textures.ts      # Texture sources
│   │   ├── stats.ts         # Performance stats
│   │   ├── ui-config.ts     # UI configuration
│   │   └── world-config.ts  # World settings
│   │
│   ├── actions/             # Input handlers
│   │   ├── actions.ts       # Key bindings
│   │   ├── actionHandlerFactory.ts
│   │   ├── cameraActionsHandler.ts
│   │   ├── geometrySelector.ts
│   │   ├── geometryMover.ts
│   │   ├── polygonCreator.ts
│   │   ├── undoService.ts
│   │   └── ...              # Other action handlers
│   │
│   ├── math/                # Math utilities
│   │   ├── vector.ts        # 2D vector operations
│   │   ├── lineSegment.ts   # Line segment operations
│   │   └── plane.ts         # Plane operations
│   │
│   ├── drawing/             # Canvas drawing utilities
│   │   ├── drawing.ts       # Primitive drawing
│   │   └── wall-painter.ts  # 3D wall rendering
│   │
│   ├── textures/            # Texture management
│   │   ├── model.ts         # Texture data models
│   │   ├── texture.ts       # Texture class
│   │   └── textureLibrary.ts # Texture library
│   │
│   ├── selection/           # Selection management
│   │   ├── selectable.ts    # Selection types
│   │   └── selection-tree.ts # Selection tree
│   │
│   ├── datastructures/      # Data structures
│   │   ├── heap.ts          # Max-heap implementation
│   │   ├── priority-queue.ts # Priority queue interface
│   │   └── utils.ts         # Array utilities
│   │
│   └── storage/             # File storage
│       └── stateLoader.ts   # World loader/saver
│
├── css/
│   └── main.css             # Main stylesheet
│
└── basepath.ts              # Base path utility
```

---

## 7. File-by-File Breakdown

### Main Process (`src/main/`)

| File | Lines | Purpose |
|------|-------|---------|
| `main.ts` | ~80 | Electron main entry - creates BrowserWindow, registers IPC handlers |
| `mainmenu.ts` | ~150 | Application menu template with file, edit, geometry operations |
| `dialogs.ts` | ~50 | Native file dialog wrappers for open/save operations |

### Renderer Process (`src/renderer/`)

| File | Lines | Purpose |
|------|-------|---------|
| `renderer.ts` | 78 | Main entry - initializes components, runs game loop |
| `testCanvas.ts` | ~100 | Debug canvas for testing/visualization |
| `index.html` | ~100 | HTML template with canvas elements and component containers |

### UI Components (`src/renderer/components/`)

| File | Purpose |
|------|---------|
| `index.ts` | Registers all custom elements |
| `geometryEditorComponent.ts` | Container for geometry editing panel |
| `geometrySelectionComponent.ts` | Tree view of selected geometry |
| `selectionTreeNodeComponent.ts` | Individual tree node component |
| `edgeEditorComponent.ts` | Edge property editing form |
| `vertexEditorComponent.ts` | Vertex property editing form |
| `polygonEditorComponent.ts` | Polygon property editing form |
| `materialEditorComponent.ts` | Material editing controls |
| `colorEditorComponent.ts` | Color picker component |
| `textureLibraryComponent.ts` | Texture library browser |
| `texture-selector.component.ts` | Texture selection dropdown |
| `texture-dropdown.component.ts` | Dropdown base component |
| `textureSourceEditorComponent.ts` | Texture source configuration |
| `directed-material.component.ts` | Face-direction material editor |
| `statsComponent.ts` | Performance statistics display |

### Web Workers (`src/workers/`)

| File | Lines | Purpose |
|------|-------|---------|
| `bspGenerator.ts` | ~30 | Web Worker for async BSP tree generation |
| `ray-caster.ts` | ~40 | Experimental parallel raycasting (not actively used) |

### Core Geometry (`src/common/geometry/`)

| File | Lines | Purpose |
|------|-------|---------|
| `geometry.ts` | ~250 | Core operations - create, load, transform, query polygons |
| `polygon.ts` | ~80 | Polygon data structure with bounding box, convexity |
| `edge.ts` | ~100 | Edge with luminosity, segments, material |
| `vertex.ts` | ~50 | Vertex with distance calculations |
| `entity.ts` | ~30 | GUID-based identity system |
| `properties.ts` | ~80 | Material system (colors, textures, luminosity) |
| `collision.ts` | ~200 | Ray-segment/ray-plane intersection, collision detection |

### BSP System (`src/common/geometry/bsp/`)

| File | Lines | Purpose |
|------|-------|---------|
| `model.ts` | ~50 | BSP node types (NullNode, LeafNode, SplitNode) |
| `creation.ts` | ~100 | `buildBspTree()` - recursive construction |
| `splitting.ts` | ~150 | Polygon splitting along planes |
| `splitting-strategies.ts` | ~50 | Plane selection strategies |
| `querying.ts` | ~100 | BSP traversal, ray intersection |
| `classification.ts` | ~80 | Point/polygon to plane classification |
| `bspGenerationStarter.ts` | ~40 | IPC handler for BSP generation |

### Rendering (`src/common/rendering/`)

| File | Lines | Purpose |
|------|-------|---------|
| `renderer.ts` | ~10 | IRenderer interface definition |
| `raycasting/renderer3d.ts` | 270 | Traditional raycasting renderer |
| `raycasting/raycaster.ts` | 132 | Ray casting logic and collision detection |
| `zbuffering/zbuffer-renderer.ts` | 241 | BSP-optimized Z-buffer renderer |
| `bspwalking/walker.ts` | ~50 | BSP tree walking utilities |
| `common/wall-drawing.ts` | ~30 | Shared wall drawing utilities |

### Editor (`src/common/editor/`)

| File | Lines | Purpose |
|------|-------|---------|
| `mapEditor.ts` | ~300 | 2D map editor renderer |
| `viewport.ts` | ~100 | Viewport/scroll handling |
| `scrollBar.ts` | ~50 | Scroll bar rendering |
| `grid.ts` | ~80 | Grid rendering utilities |
| `colors.ts` | ~30 | Color constants |

### State Management (`src/common/store/`)

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~50 | Redux store configuration |
| `store-connector.ts` | ~15 | Simple pub/sub for store subscriptions |
| `walls.ts` | ~150 | Geometry state with undo/redo history |
| `player.ts` | ~50 | Camera position/direction state |
| `selection.ts` | ~80 | Selection state management |
| `textures.ts` | ~50 | Loaded texture sources |
| `stats.ts` | ~40 | Performance statistics |
| `ui-config.ts` | ~30 | UI toggle states |
| `world-config.ts` | ~30 | World configuration (fading, etc.) |

### Action Handlers (`src/common/actions/`)

| File | Lines | Purpose |
|------|-------|---------|
| `actions.ts` | ~80 | Action types, key bindings, flag system |
| `actionHandlerFactory.ts` | ~50 | Factory for creating all handlers |
| `cameraActionsHandler.ts` | ~80 | WASD + arrow key movement |
| `geometrySelector.ts` | ~120 | Mouse-based geometry selection |
| `geometryMover.ts` | ~100 | Drag-and-drop geometry movement |
| `geometryRemover.ts` | ~50 | Geometry deletion |
| `edgeSplitter.ts` | ~80 | Edge splitting |
| `edgeModifier.ts` | ~80 | Edge modification |
| `polygonCreator.ts` | ~100 | Creating new polygons |
| `polygonExpander.ts` | ~80 | Polygon expansion |
| `polygonRotator.ts` | ~80 | Polygon rotation |
| `polygonReverser.ts` | ~40 | Reversing winding order |
| `polygonSplitter.ts` | ~60 | Splitting polygons |
| `undoService.ts` | ~30 | Undo/redo keyboard handler |
| `globalActionHandler.ts` | ~50 | Global keyboard shortcuts |

### Math Utilities (`src/common/math/`)

| File | Lines | Purpose |
|------|-------|---------|
| `vector.ts` | ~100 | 2D vector operations (dot, cross, normalize, rotate, etc.) |
| `lineSegment.ts` | ~150 | Line segment operations (intersection, projection, distance) |
| `plane.ts` | ~80 | 2D plane representation and operations |

### Drawing Utilities (`src/common/drawing/`)

| File | Lines | Purpose |
|------|-------|---------|
| `drawing.ts` | ~120 | Primitive drawing (vectors, segments, trapezoids, planes) |
| `wall-painter.ts` | 131 | WallPainter class for 3D wall rendering |

### Textures (`src/common/textures/`)

| File | Lines | Purpose |
|------|-------|---------|
| `model.ts` | ~30 | Texture data models |
| `texture.ts` | ~150 | Texture class - loads and draws from sprite sheets |
| `textureLibrary.ts` | ~80 | TextureLibrary - manages loaded textures |

### Data Structures (`src/common/datastructures/`)

| File | Lines | Purpose |
|------|-------|---------|
| `heap.ts` | ~80 | Max-heap implementation |
| `priority-queue.ts` | ~20 | Priority queue interface |
| `utils.ts` | ~10 | Array swap utility |

### Tests (`*.test.ts` / `*.spec.ts`)

| File | Purpose |
|------|---------|
| `camera.test.ts` | Camera tests (mostly performance benchmarks) |
| `vector.test.ts` | Vector operations tests |
| `lineSegment.test.ts` | Line segment operations tests |
| `polygon.test.ts` | Polygon operations tests |
| `geometry.test.ts` | Core geometry tests |
| `collision.spec.ts` | Collision detection tests |
| `splitting.spec.ts` | BSP splitting tests |
| `classification.spec.ts` | BSP classification tests |
| `texture.test.ts` | Texture loading tests |

---

## 8. Key Components Deep Dive

### 8.1 Camera System

**File:** `src/common/camera.ts`

The camera represents the viewer's position and orientation:

```typescript
interface ICamera {
    position: Vector;      // Camera location [x, y]
    direction: Vector;     // Look direction (normalized)
    screen: ILineSegment;  // Virtual screen plane for raycasting
    fov: number;           // Field of view
    depth: number;         // Camera depth for projection
}
```

**Key Functions:**
- `moveForward(camera, speed)` - Move along direction vector
- `strafeLeft(camera, speed)` - Move perpendicular to direction
- `rotateLeft(camera, angle)` - Rotate direction vector
- `makeRays(resolution, camera)` - Generate rays through screen plane
- `clip(edge, camera)` - Clip edge to camera frustum

### 8.2 Geometry System

**Core Data Structures:**

```typescript
// Polygon - closed shape made of edges
interface IPolygon {
    id: IEntityKey;
    vertices: IVertex[];
    edges: IEdge[];
    boundingBox: IBoundingBox;
}

// Edge - line segment with rendering properties
interface IEdge {
    id: IEntityKey;
    start: IVertex;
    end: IVertex;
    segment: ILineSegment;
    material: IMaterial | null;
    luminosity: number;
    immaterial: boolean;
}

// Vertex - point in 2D space
interface IVertex {
    id: IEntityKey;
    vector: Vector;
}
```

### 8.3 BSP Tree

**Purpose:** Optimize rendering by spatially partitioning geometry.

**Node Types:**
```typescript
type BspNode = NullNode | LeafNode | SplitNode;

interface LeafNode {
    type: 'leaf';
    polygons: IPolygon[];
}

interface SplitNode {
    type: 'split';
    plane: Plane;
    front: BspNode;
    back: BspNode;
    count: number;
}
```

**Usage Flow:**
1. User triggers BSP generation via menu
2. `buildBspTree()` recursively partitions polygons
3. During rendering, `walk()` traverses tree front-to-back
4. Only visible geometry is processed

### 8.4 Rendering Pipeline

**Renderer3d (Traditional):**
```
makeRays() → castCollisionRays() → constructZBuffer() → drawZBuffer()
    ↓              ↓                    ↓                  ↓
640 rays    Test all edges      Group by edge ID    Draw back-to-front
```

**ZBufferRenderer (BSP-Optimized):**
```
walk(bsp) → clip(edge, camera) → castRaysOnEdge() → render()
    ↓              ↓                   ↓              ↓
Front-to-back  Frustum cull      Only visible     Per-column
traversal                         edges            drawing
```

### 8.5 Redux State Structure

```typescript
interface RootState {
    stats: {
        performance: { timing, fps };
        intersections: { stats };
    };
    selection: {
        vertices: SelectedVertex[];
        edges: SelectedEdge[];
        polygons: SelectedPolygon[];
    };
    player: {
        camera: ICamera;
    };
    walls: {
        geometry: IGeometry;
        history: IGeometry[];
        historyIndex: number;
    };
    worldConfig: {
        fadeOn: number | null;
        horizonDistance: number;
    };
    uiConfig: {
        showBsp: boolean;
        showTestCanvas: boolean;
    };
    textures: {
        sources: ITextureSource[];
    };
}
```

---

## 9. Data Flow

### Main Loop

```typescript
// src/renderer/renderer.ts
function loop() {
    const now = performance.now();
    
    // Calculate FPS
    while (times.length > 0 && times[0] <= now - 1000) { 
        times.shift(); 
    }
    times.push(now);
    fps = times.length;
    
    // Render all views
    redraw();
    
    // Process input
    update();
    
    window.requestAnimationFrame(loop);
}
```

### Input → State → Render Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INPUT                           │
│  (keyboard/mouse events captured by action handlers)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     ACTION HANDLERS                          │
│  CameraActionsHandler: WASD → moveCamera action              │
│  GeometryMover: drag → moveVertex action                     │
│  PolygonCreator: click → addPolygon action                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     REDUX DISPATCH                           │
│  dispatch(moveCamera({ position, direction }))               │
│  dispatch(wallsReplaced(newGeometry))                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      REDUX STORE                             │
│  Reducers update state immutably                            │
│  History is pushed for undo support                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   STORE CONNECTOR                            │
│  connect(callback) - notifies all subscribers                │
│  Components receive new state via callback                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RENDERING                               │
│  MapEditor.render() - 2D top-down view                       │
│  Renderer3d.render() OR ZBufferRenderer.render() - 3D view   │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Points for Improvement

### 10.1 Resolved Issues (Since Feb 6, 2026)

The following critical issues from the original review have been **RESOLVED**:

#### ✅ 10.1.1 Electron Updated to v28.1.0

**Status:** RESOLVED in commit `9e00541`

| Before | After |
|--------|-------|
| `"electron": "^13.1.6"` | `"electron": "^28.1.0"` |

Electron is now on a current, supported version with security patches.

#### ✅ 10.1.2 Context Isolation Enabled

**Status:** RESOLVED in commit `9e00541`

The application now uses secure Electron configuration:

```typescript
// src/main/main.ts - CURRENT (secure)
mainWindow = new BrowserWindow({
    webPreferences: {
        nodeIntegration: false,      // ✅ Disabled
        contextIsolation: true,      // ✅ Enabled
        preload: preloadPath,        // ✅ Using preload script
    }
});
```

A new preload script (`src/main/preload.ts`) provides secure IPC communication with channel whitelisting.

#### ✅ 10.1.3 Error Handling for File Operations

**Status:** RESOLVED in commit `9e00541`

The `stateLoader.ts` file now has comprehensive error handling:

```typescript
// src/common/storage/stateLoader.ts - CURRENT (with error handling)
private loadFile = async (filePath: string): Promise<void> => {
    try {
        const data = await window.electronAPI.readFile(filePath);
        const content = new TextDecoder().decode(data);
        this.loadWorld(JSON.parse(content));
        // ...
    } catch (error) {
        console.error('Failed to load file:', error);
        this.showError('Load File Failed', `Could not load world from: ${filePath}`);
        localStorage.removeItem('loadedFile');
    }
};
```

All file operations (`loadFile`, `saveFile`, `importTexture`) now have try-catch with user-friendly error dialogs.

---

### 10.2 Remaining Code Quality Issues

#### 10.2.1 Type Duplication - WallProps

**Locations:**
- `src/common/rendering/raycasting/renderer3d.ts:21-32`
- `src/common/drawing/wall-painter.ts:12-23`

**Current State:** Identical type definition in both files:
```typescript
export type WallProps = {
    edgeId: IEntityKey,
    height: number,
    edgeLuminosity: number,
    material: IMaterial,
    intersection: Vector,
    origin: Vector,
    length: number,
    rowRange: [number, number],
    colRange: [number, number],
    distance: number,
};
```

**Recommendation:** Create a shared types file:
```typescript
// src/common/types/rendering.ts
export type WallProps = {
    edgeId: IEntityKey,
    height: number,
    // ... rest of properties
};
```

#### 10.2.2 Code Duplication - drawBackground

**Locations:**
- `src/common/rendering/raycasting/renderer3d.ts:184-197`
- `src/common/rendering/zbuffering/zbuffer-renderer.ts:123-136`

**Recommendation:** Extract to a shared utility:
```typescript
// src/common/rendering/common/background-renderer.ts
export class BackgroundRenderer {
    constructor(
        private context: CanvasRenderingContext2D,
        private width: number,
        private height: number
    ) {}

    drawSky(worldConfig: IWorldConfigState) {
        this.drawBackground('rgb(200,200,200)', 0, this.height / 2, worldConfig);
    }

    drawFloor(worldConfig: IWorldConfigState) {
        this.drawBackground('rgb(50,80,80)', this.height / 2, this.height, worldConfig);
    }

    private drawBackground(color: string, startRow: number, endRow: number, worldConfig: IWorldConfigState) {
        // ... implementation
    }
}
```

#### 10.2.3 Usage of `any` Types

**Locations:**

| File | Line | Current | Recommended |
|------|------|---------|-------------|
| `stateLoader.ts` | 89 | `(w: any)` | Create `IWorldData` interface |
| `utils.ts` | 1 | `swap(a: any[], ...)` | Use generics: `swap<T>(a: T[], ...)` |
| `main.ts` | 39 | `null as any` | `BrowserWindow \| null = null` |

**Example Fix:**
```typescript
// src/common/datastructures/utils.ts

// Before:
export function swap(a: any[], x: number, y: number): any[] {
    [a[x], a[y]] = [a[y], a[x]];
    return a;
}

// After:
export function swap<T>(a: T[], x: number, y: number): T[] {
    [a[x], a[y]] = [a[y], a[x]];
    return a;
}
```

#### 10.2.4 Deprecated API Usage

**Location:** `src/common/actions/actions.ts:37, 42, 51`

**Current State:**
```typescript
if (event.keyCode === keyDefiniton.key) { ... }
```

**Issue:** `event.keyCode` is deprecated.

**Recommendation:**
```typescript
// Update to use event.code
if (event.code === keyDefiniton.code) { ... }

// Update key definitions
const keyDefinitions = {
    moveForward: { code: 'KeyW', ... },
    moveBackward: { code: 'KeyS', ... },
    // ...
};
```

---

### 10.3 Performance Improvements (with Code Samples)

#### 10.3.1 FPS Calculation - O(n) Array Shift

**Location:** `src/renderer/renderer.ts:52-56`

**Current State:**
```typescript
const times: number[] = [];
let fps: number;

function loop() {
    const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) { 
        times.shift();  // O(n) operation!
    }
    times.push(now);
    fps = times.length;
    // ...
}
```

**Issue:** `Array.shift()` is O(n) because it requires shifting all elements. With 60 FPS, this array holds ~60 elements, causing unnecessary overhead every frame.

**Recommended Fix - Circular Buffer:**
```typescript
class CircularFpsCounter {
    private buffer: Float64Array;
    private head = 0;
    private tail = 0;
    private count = 0;
    
    constructor(private maxSize = 120) {
        this.buffer = new Float64Array(maxSize);
    }
    
    push(timestamp: number): void {
        this.buffer[this.head] = timestamp;
        this.head = (this.head + 1) % this.maxSize;
        
        if (this.count < this.maxSize) {
            this.count++;
        } else {
            this.tail = (this.tail + 1) % this.maxSize;
        }
    }
    
    getFps(now: number): number {
        // Remove old entries (older than 1 second)
        while (this.count > 0 && this.buffer[this.tail] <= now - 1000) {
            this.tail = (this.tail + 1) % this.maxSize;
            this.count--;
        }
        return this.count;
    }
}

// Usage:
const fpsCounter = new CircularFpsCounter();

function loop() {
    const now = performance.now();
    fpsCounter.push(now);
    const fps = fpsCounter.getFps(now);
    // ...
}
```

**Benefit:** O(1) insertion, no array reallocation.

#### 10.3.2 Object Allocation in Hot Paths - ZBuffer

**Location:** `src/common/rendering/zbuffering/zbuffer-renderer.ts:142-145`

**Current State:**
```typescript
// Called every frame!
constructor(...) {
    this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
    this.rays = makeRays(this.resolution, this.camera);
}
```

**Issue:** Creates 640+ new ZBufferColumn objects and ray objects every frame, causing garbage collection pressure.

**Recommended Fix - Object Pooling:**
```typescript
export class ZBuffer {
    private cols: ZBufferColumn[];
    private rays: IRay[];
    private initialized = false;
    
    constructor(private resolution: number, private camera: ICamera, ...) {
        // Pre-allocate once
        if (!this.initialized) {
            this.cols = Array.from({ length: resolution }, () => new ZBufferColumn());
            this.rays = new Array(resolution);
            this.initialized = true;
        }
    }
    
    public reset(camera: ICamera): void {
        // Reset existing objects instead of creating new ones
        for (const col of this.cols) {
            col.clear();  // Add clear() method to ZBufferColumn
        }
        updateRays(this.rays, this.resolution, camera);  // Modify in-place
    }
}

// Add clear method to ZBufferColumn
export class ZBufferColumn {
    clear(): void {
        while (this.queue.length > 0) {
            this.queue.shift();
        }
    }
}
```

#### 10.3.3 Stats Object Allocation in Loop

**Location:** `src/common/rendering/raycasting/raycaster.ts:70-79`

**Current State:**
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): CastingStats => {
    iStats.polygons.forEach(x => stats.polygons.add(x));
    return ({  // Creates new object every call!
        polygons: stats.polygons,
        edgeTests: [Math.min(stats.edgeTests[0], iStats.testedEdges), ...],
        // ...
    });
}
```

**Issue:** Creates a new stats object for every ray (640+ times per frame).

**Recommended Fix - Mutate in Place:**
```typescript
const accumulateStats = (stats: CastingStats, iStats: IntersectionStats): void => {
    iStats.polygons.forEach(x => stats.polygons.add(x));
    
    // Mutate existing object
    stats.edgeTests[0] = Math.min(stats.edgeTests[0], iStats.testedEdges);
    stats.edgeTests[1] = Math.max(stats.edgeTests[1], iStats.testedEdges);
    stats.polygonTests[0] = Math.min(stats.polygonTests[0], iStats.testedPolygons);
    stats.polygonTests[1] = Math.max(stats.polygonTests[1], iStats.testedPolygons);
    stats.edgeCount = Math.max(stats.edgeCount, iStats.totalEdges);
    stats.polygonCount = Math.max(stats.polygonCount, iStats.totalPolygons);
    stats.edgePercentage = iStats.totalEdges !== 0 
        ? Math.max(stats.edgePercentage, iStats.testedEdges / iStats.totalEdges) 
        : stats.edgePercentage;
}
```

#### 10.3.4 Use Typed Arrays for Vectors

**Location:** `src/common/math/vector.ts`

**Current State:**
```typescript
export type Vector = [number, number];
```

**Issue:** JavaScript arrays have overhead compared to typed arrays for numeric operations.

**Recommended Fix for Performance-Critical Paths:**
```typescript
// For hot paths in raycasting, use Float64Array
export class Vec2 {
    private data: Float64Array;
    
    constructor(x: number = 0, y: number = 0) {
        this.data = new Float64Array(2);
        this.data[0] = x;
        this.data[1] = y;
    }
    
    get x(): number { return this.data[0]; }
    get y(): number { return this.data[1]; }
    set x(v: number) { this.data[0] = v; }
    set y(v: number) { this.data[1] = v; }
    
    // Mutating operations for zero-allocation math
    addInPlace(other: Vec2): Vec2 {
        this.data[0] += other.data[0];
        this.data[1] += other.data[1];
        return this;
    }
    
    scaleInPlace(k: number): Vec2 {
        this.data[0] *= k;
        this.data[1] *= k;
        return this;
    }
    
    // ... more operations
}

// Pre-allocate reusable vectors for hot paths
const tempVec1 = new Vec2();
const tempVec2 = new Vec2();
```

#### 10.3.5 Normalize Movement Speed to FPS

**Current Issue (from TODO file):** Movement speed is tied to FPS - slower FPS means slower movement.

**Location:** `src/common/actions/cameraActionsHandler.ts`

**Recommended Fix - Delta Time:**
```typescript
export class CameraActionsHandler implements IActionHandler {
    private lastFrameTime = performance.now();
    
    handle = () => {
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000; // seconds
        this.lastFrameTime = now;
        
        const baseSpeed = 50; // units per second
        const actualSpeed = baseSpeed * deltaTime;
        
        if (this.flags.moveForward.value) {
            dispatch(moveCamera(moveForward(this.camera, actualSpeed)));
        }
        // ... apply deltaTime to all movements
    }
}
```

---

### 10.4 Test Coverage Gaps

#### Current Test Coverage

| Module | Test File | Coverage |
|--------|-----------|----------|
| Math/Vector | `vector.test.ts` | Basic operations |
| Math/LineSegment | `lineSegment.test.ts` | Basic operations |
| Geometry/Polygon | `polygon.test.ts` | Basic operations |
| Geometry/Core | `geometry.test.ts` | Basic operations |
| Geometry/Collision | `collision.spec.ts` | Intersection tests |
| BSP/Splitting | `splitting.spec.ts` | Split operations |
| BSP/Classification | `classification.spec.ts` | Classification tests |
| Camera | `camera.test.ts` | Performance benchmarks only |
| Textures | `texture.test.ts` | Loading tests |

#### Missing Test Coverage

| Module | Priority | Reason |
|--------|----------|--------|
| **Rendering (renderer3d, zbuffer-renderer)** | High | Core functionality, complex logic |
| **Redux Store (walls, player, selection)** | High | State management is critical |
| **Action Handlers** | Medium | User interaction logic |
| **Editor (mapEditor)** | Medium | Core user-facing feature |
| **UI Components** | Low | Web Components, UI logic |
| **File I/O (stateLoader)** | High | Data integrity |
| **Data Structures (heap)** | Medium | Custom implementation |

#### Recommended Test Additions

```typescript
// Example: src/common/rendering/raycasting/renderer3d.test.ts
describe('Renderer3d', () => {
    let renderer: Renderer3d;
    let mockCanvas: HTMLCanvasElement;
    
    beforeEach(() => {
        mockCanvas = document.createElement('canvas');
        renderer = new Renderer3d(mockCanvas);
    });
    
    describe('isActive', () => {
        it('returns true when no BSP exists', () => {
            // Set up geometry without BSP
            expect(renderer.isActive()).toBe(true);
        });
        
        it('returns false when BSP exists', () => {
            // Set up geometry with BSP
            expect(renderer.isActive()).toBe(false);
        });
    });
    
    describe('convertDistanceToWallHeight', () => {
        it('calculates correct height for given distance', () => {
            // Test wall height calculation
        });
    });
});

// Example: src/common/store/walls.test.ts
describe('walls reducer', () => {
    it('should handle wallsReplaced', () => {
        const initialState = { geometry: EMPTY_GEOMETRY, history: [], historyIndex: 0 };
        const newGeometry = createTestGeometry();
        
        const result = wallsReducer(initialState, wallsReplaced(newGeometry));
        
        expect(result.geometry).toEqual(newGeometry);
        expect(result.history).toHaveLength(1);
    });
    
    it('should handle undo', () => {
        // Test undo functionality
    });
    
    it('should handle redo', () => {
        // Test redo functionality
    });
});
```

---

### 10.5 Technical Debt

#### TODO Comments in Code

| File | Line | TODO Content | Priority |
|------|------|--------------|----------|
| `src/common/math/vector.ts` | 29 | `TODO centralize constants` | Low |
| `src/common/geometry/vertex.ts` | 12 | `TODO: magic constant` | Medium |
| `src/common/geometry/polygon.ts` | 25 | `TODO: areClose?` | Low |
| `src/common/storage/stateLoader.ts` | 70 | `TODO: error handling` | **High** |
| `src/common/camera.ts` | 47 | `TODO: magic constant` | Medium |
| `src/common/camera.ts` | 101, 105, 147 | Multiple camera TODOs | Medium |
| `src/common/actions/geometrySelector.ts` | 92 | `TODO: these declarations belong somewhere else` | Low |
| `src/common/actions/edgeModifier.ts` | 57 | `TODO: are we adapting exterior/interior...` | Medium |
| `src/common/actions/cameraActionsHandler.ts` | 34 | `TODO: speed of movement...` | Medium |
| `src/common/rendering/zbuffering/zbuffer-renderer.ts` | 68 | `TODO: can't we pass direction...` | Low |

#### Project TODO File Items

From `TODO` file at project root:

**Bugs:**
- [ ] Completely translucent edge drawn as fading shadow
- [ ] Selection highlighting overdraw issue
- [ ] Texture library receives duplicates on file load

**Features:**
- [ ] Store BSP in saved map files
- [ ] Auto-regenerate BSP on geometry change
- [ ] Implement sprites
- [ ] Implement doors
- [ ] Implement mirror walls
- [ ] Flickering lights (luminosity as function of time)

**Improvements:**
- [ ] Normalize movement speed to FPS
- [ ] Batch edit multiple edges
- [ ] Polygon expansion should stay parallel to edges

---

### 10.6 Architectural Improvements

#### 10.6.1 Memory Leaks - Event Listeners Never Removed

**Issue:** 52 `addEventListener` calls found, 0 `removeEventListener` calls.

**Affected Files:**
- `src/common/actions/polygonCreator.ts:31-36`
- `src/common/actions/geometryMover.ts:26-28`
- `src/common/actions/geometrySelector.ts:28-30`
- `src/common/actions/polygonRotator.ts:36-38`
- `src/common/actions/edgeSplitter.ts:37-39`
- All UI components with event listeners

**Example Problem:**
```typescript
// src/common/actions/polygonCreator.ts
register(g: GlobalEventHandlers): IActionHandler {
    ipcRenderer.on('geometry_polygon_clone', this.duplicatePolygon);
    ipcRenderer.on('geometry_polygon_create', this.startCreation);        
    g.addEventListener('mousemove', this.prepareNextVertex);
    g.addEventListener('mouseup', this.decideNextVertex);
    g.addEventListener('contextmenu', this.cancel, false); 
    return this;
    // No cleanup ever happens!
}
```

**Recommended Fix - Implement Cleanup Pattern:**
```typescript
export interface IActionHandler {
    handle: () => void;
    register: (g: GlobalEventHandlers) => IActionHandler;
    dispose: () => void;  // Add dispose method
}

export class PolygonCreator implements IActionHandler {
    private eventTarget: GlobalEventHandlers | null = null;
    private ipcHandlers: { channel: string; handler: Function }[] = [];
    
    register(g: GlobalEventHandlers): IActionHandler {
        this.eventTarget = g;
        
        // Store references for cleanup
        this.ipcHandlers = [
            { channel: 'geometry_polygon_clone', handler: this.duplicatePolygon },
            { channel: 'geometry_polygon_create', handler: this.startCreation },
        ];
        
        this.ipcHandlers.forEach(({ channel, handler }) => {
            ipcRenderer.on(channel, handler as any);
        });
        
        g.addEventListener('mousemove', this.prepareNextVertex);
        g.addEventListener('mouseup', this.decideNextVertex);
        g.addEventListener('contextmenu', this.cancel, false);
        
        return this;
    }
    
    dispose(): void {
        if (this.eventTarget) {
            this.eventTarget.removeEventListener('mousemove', this.prepareNextVertex);
            this.eventTarget.removeEventListener('mouseup', this.decideNextVertex);
            this.eventTarget.removeEventListener('contextmenu', this.cancel);
        }
        
        this.ipcHandlers.forEach(({ channel, handler }) => {
            ipcRenderer.removeListener(channel, handler as any);
        });
        
        this.eventTarget = null;
        this.ipcHandlers = [];
    }
}
```

#### 10.6.2 Store Subscriptions Never Cleaned Up

**Issue:** `connect()` returns cleanup function but it's never called.

**Affected Files:**
- `src/common/rendering/raycasting/renderer3d.ts:53`
- `src/common/editor/mapEditor.ts:47`
- `src/common/textures/textureLibrary.ts:14`
- All classes using `connect()`

**Recommended Fix:**
```typescript
export class Renderer3d implements IRenderer {
    private unsubscribe: (() => void) | null = null;
    
    constructor(private canvas: HTMLCanvasElement) {
        // Store cleanup function
        this.unsubscribe = connect(s => {
            this.camera = s.player.camera;
            // ...
        });
    }
    
    dispose(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}
```

#### 10.6.3 Module-Level Store Access

**Issue:** `useAppDispatch()` called at module scope creates tight coupling.

**Current Pattern (problematic):**
```typescript
// src/common/actions/polygonCreator.ts:12
const dispatch = useAppDispatch();  // Module-level!

export class PolygonCreator {
    // Uses module-level dispatch
}
```

**Issues:**
- Hard to test (can't mock dispatch)
- Store must be initialized before module loads
- Creates hidden dependencies

**Recommended Fix - Dependency Injection:**
```typescript
// Use constructor injection
export class PolygonCreator implements IActionHandler {
    constructor(private dispatch: AppDispatch) {}
    
    // Now testable with mock dispatch
}

// Factory handles dependency resolution
export function createPolygonCreator(): PolygonCreator {
    return new PolygonCreator(store.dispatch);
}
```

#### 10.6.4 Web Workers Not Terminated

**Location:** `src/common/rendering/raycasting/raycaster.ts:103-106`

**Current State:**
```typescript
export class PartionedRayCaster {
    private workers: Worker[] = [];
    constructor() {
        this.workers = Array.from(Array(3).keys()).map(
            _ => new Worker("../workers/dist/rayCaster-bundle.js")
        );
        // Workers are never terminated!
    }
}
```

**Recommended Fix:**
```typescript
export class PartionedRayCaster {
    private workers: Worker[] = [];
    
    constructor() {
        this.workers = Array.from(Array(3).keys()).map(
            _ => new Worker("../workers/dist/rayCaster-bundle.js")
        );
    }
    
    dispose(): void {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }
}
```

---

## 11. Dependency Audit

### Production Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| `@reduxjs/toolkit` | ^1.6.0 | 2.0.1 | **Major behind** | Breaking changes in v2 |
| `electron` | ^28.1.0 | 28.x | **✅ Current** | Updated from 13.1.6 |
| `guid-typescript` | ^1.0.9 | 1.0.9 | Current | |
| `image-size` | ^1.0.0 | 1.1.1 | Minor behind | |
| `priority-deque` | ^1.0.4 | 1.0.4 | Current | |
| `redux-logger` | ^3.0.6 | 3.0.6 | Current | |
| `ts-node` | ^10.1.0 | 10.9.2 | Minor behind | |
| `typescript` | ^5.3.3 | 5.x | **✅ Current** | Updated from 4.3.5 |
| `webpack` | ^5.44.0 | 5.89.0 | Minor behind | |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| `@types/image-size` | ^0.8.0 | - | May need update | |
| `@types/jest` | ^26.0.24 | 29.5.11 | **Major behind** | |
| `@types/node` | ^20.10.6 | 20.x | **✅ Current** | Updated from 16.3.1 |
| `jest` | ^27.0.6 | 29.7.0 | **Major behind** | |
| `jest-canvas-mock` | ^2.3.1 | 2.5.2 | Minor behind | |
| `npm-run-all` | ^4.1.5 | 4.1.5 | Current | |
| `ts-jest` | ^27.0.3 | 29.1.1 | **Major behind** | Must match Jest |
| `ts-loader` | ^9.2.3 | 9.5.1 | Minor behind | |
| `webpack-cli` | ^4.7.2 | 5.1.4 | **Major behind** | |

**Note:** The deprecated `@types/electron` package has been removed - types are now bundled with electron.

### Recommended package.json Updates

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.0.1",
    "guid-typescript": "^1.0.9",
    "image-size": "^1.1.1",
    "priority-deque": "^1.0.4",
    "redux-logger": "^3.0.6",
    "ts-node": "^10.9.2",
    "webpack": "^5.89.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "jest-canvas-mock": "^2.5.2",
    "npm-run-all": "^4.1.5",
    "ts-jest": "^29.1.1",
    "ts-loader": "^9.5.1",
    "webpack-cli": "^5.1.4"
  }
}
```

---

## 12. Priority Action Items (Checklist)

### ✅ Completed (Critical Security/Stability)

- [x] **Update Electron to v28+** and enable context isolation
  - [x] Update `package.json` electron version
  - [x] Update `main.ts` webPreferences to use contextIsolation
  - [x] Create preload script for IPC
  - [x] Update all IPC usage patterns

- [x] **Add error handling** for file operations
  - [x] Wrap `JSON.parse` in try-catch
  - [x] Handle file read errors
  - [x] Show user-friendly error messages

### Remaining Critical Priority (Memory/Stability)

- [x] **Fix memory leaks** - implement cleanup for event listeners
  - [x] Add `dispose()` method to all action handlers
  - [x] Clean up store subscriptions
  - [x] Terminate web workers when not needed

### High Priority (Maintainability)

- [ ] **Extract duplicated code**
  - [ ] Create shared `WallProps` type
  - [ ] Extract `BackgroundRenderer` utility
  - [ ] Consolidate `drawTexture` and `applyFading` methods

- [ ] **Remove `any` types** and enable strict mode
  - [x] ~~Fix `stateLoader.ts` loadWorld parameter~~ (partially addressed, still uses `any`)
  - [ ] Fix `utils.ts` swap function with generics
  - [ ] Enable `strict: true` in workers tsconfig

- [ ] **Add comprehensive tests**
  - [ ] Rendering pipeline tests
  - [ ] Redux store/reducer tests
  - [ ] File I/O tests with error cases

### Medium Priority (Performance)

- [ ] **Optimize FPS calculation** with circular buffer
- [ ] **Implement object pooling** for ZBuffer columns and rays
- [ ] **Reduce allocations** in stats accumulation
- [ ] **Normalize movement speed** to delta time

### Low Priority (Code Quality)

- [ ] **Address TODO comments** in code
- [ ] **Add JSDoc documentation** for public APIs
- [ ] **Migrate deprecated APIs** (keyCode → code)
- [ ] **Implement dependency injection** for testability
- [ ] **Update dev dependencies** (Jest, webpack-cli)

---

## 13. Summary of Recommendations

### ✅ Completed Actions (Feb 6-9, 2026)

1. ~~**Security:** Update Electron immediately~~ **DONE** - Upgraded to v28.1.0
2. ~~**Security:** Enable context isolation~~ **DONE** - Added preload script
3. ~~**Stability:** Implement error handling for file operations~~ **DONE** - Full try-catch coverage

### Remaining Immediate Actions

1. **Memory:** Add cleanup patterns for all event listeners and subscriptions

### Short-term Improvements (1-2 weeks)

1. Extract duplicated code to shared modules
2. Enable strict TypeScript mode across all configs
3. Add tests for critical rendering and state management code
4. Fix deprecated API usage

### Medium-term Improvements (1 month)

1. Implement performance optimizations (object pooling, circular buffer)
2. Add comprehensive test coverage (target 80%+)
3. Implement dependency injection for better testability
4. Complete or remove experimental web worker features

### Long-term Improvements (ongoing)

1. Address all TODO items in code and TODO file
2. Add JSDoc documentation
3. Consider architectural improvements for scalability
4. Keep dependencies up to date

---

*This code review was generated by AI analysis and updated on February 9, 2026. The original review was from February 6, 2026. This update reflects significant security and stability improvements made in commits `9e00541` and `c9ba2b8`.*
