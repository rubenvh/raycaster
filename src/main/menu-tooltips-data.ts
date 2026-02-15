// Tooltip descriptions for each geometry menu operation.
// Each entry contains an ASCII art example and the selection requirement.

export type SelectionType = 'none' | 'any' | 'polygon' | 'polygons' | 'edge' | 'vertex' | 'vertices';

export interface MenuTooltip {
  title: string;
  ascii: string;
  requires: SelectionType;
  requiresDescription: string;
}

const tooltips: Record<string, MenuTooltip> = {

  // === Polygon Creation ===
  createPolygon: {
    title: 'Create Polygon',
    requires: 'none',
    requiresDescription: 'No selection (deselect all first)',
    ascii:
`Click vertices to define shape:

  1 ─── 2      Click near vertex 1
  │      \\      to close the polygon
  │       3
  │      /
  5 ─── 4`
  },

  clonePolygon: {
    title: 'Clone Polygon',
    requires: 'polygon',
    requiresDescription: 'Select one or more polygons',
    ascii:
`Duplicates selected polygon(s):

  ┌───┐           ┌───┐ ┌───┐
  │ A │    ──►    │ A │ │ A'│
  └───┘           └───┘ └───┘

  Copy is offset diagonally.`
  },

  expandPolygon: {
    title: 'Expand Polygon',
    requires: 'any',
    requiresDescription: 'Select a polygon, edge, or vertex',
    ascii:
`Extrude polygon toward mouse:

  ┌──┐            ┌──────┐
  │  │    ──►     │      │
  └──┘            │  ┌──┐│
                  └──┘  ││
                     └──┘`
  },

  splitPolygon: {
    title: 'Split Polygon',
    requires: 'polygon',
    requiresDescription: 'Select a polygon',
    ascii:
`Cut polygon along a line:

  ┌───────┐       ┌───┬───┐
  │       │  ──►  │ A │ B │
  │       │       │   │   │
  └───────┘       └───┴───┘`
  },

  rotatePolygon: {
    title: 'Rotate Polygon',
    requires: 'any',
    requiresDescription: 'Select a polygon, edge, or vertex',
    ascii:
`Drag to rotate around center:

      ╱╲              ┌──┐
     ╱  ╲    ──►      │  │
    ╱    ╲            └──┘
   ╱──────╲    (45° rotation)`
  },

  reversePolygon: {
    title: 'Reverse Winding',
    requires: 'polygon',
    requiresDescription: 'Select one or more polygons',
    ascii:
`Reverse edge direction (CW↔CCW):

  ──► ──► ──►     ◄── ◄── ◄──
  │           │   │           │
  ▲   CW ──► ▼   ▼  CCW ──► ▲
  │           │   │           │
  ◄── ◄── ◄──     ──► ──► ──►`
  },

  // === Polygon Transform ===
  flipH: {
    title: 'Flip Horizontal',
    requires: 'polygon',
    requiresDescription: 'Select one or more polygons',
    ascii:
`Mirror across vertical center axis:

  ╲     │         │     ╱
   ╲    │         │    ╱
    ╲   │   ──►   │   ╱
     ╲  │         │  ╱
      ╲ │         │ ╱`
  },

  flipV: {
    title: 'Flip Vertical',
    requires: 'polygon',
    requiresDescription: 'Select one or more polygons',
    ascii:
`Mirror across horizontal center axis:

   ╱╲             ╲╱
  ╱  ╲    ──►    ╱  ╲
 ╱────╲         ╲────╱
  ────           ────`
  },

  scaleUp: {
    title: 'Scale Up (10%)',
    requires: 'polygon',
    requiresDescription: 'Select one or more polygons',
    ascii:
`Enlarge polygon by 10%:

   ┌──┐          ┌────┐
   │  │   ──►    │    │
   └──┘          │    │
                 └────┘`
  },

  scaleDown: {
    title: 'Scale Down (10%)',
    requires: 'polygon',
    requiresDescription: 'Select one or more polygons',
    ascii:
`Shrink polygon by 10%:

  ┌────┐          ┌──┐
  │    │   ──►    │  │
  │    │          └──┘
  └────┘`
  },

  regularize: {
    title: 'Regularize Polygon',
    requires: 'polygon',
    requiresDescription: 'Select exactly one polygon',
    ascii:
`Make all edges equal length:

   ╱╲               /\\
  │   ╲    ──►     /  \\
  │    │          /    \\
   ╲  ╱           \\  /
    ╲╱             \\/
 (irregular)    (regular)`
  },

  convexHull: {
    title: 'Convex Hull',
    requires: 'polygon',
    requiresDescription: 'Select exactly one polygon',
    ascii:
`Wrap polygon in convex shape:

    ╱╲             ╱──╲
   │  ╲           ╱    ╲
   │ ╱ │   ──►   │      │
    ╲  │          ╲    ╱
     ╲╱            ╲──╱
 (concave)       (convex)`
  },

  insetPolygon: {
    title: 'Inset Polygon',
    requires: 'polygon',
    requiresDescription: 'Select exactly one polygon',
    ascii:
`Create inner copy at fixed distance:

  ┌──────────┐
  │ ┌──────┐ │
  │ │ inset│ │
  │ └──────┘ │
  └──────────┘`
  },

  mergePolygons: {
    title: 'Merge Polygons',
    requires: 'polygons',
    requiresDescription: 'Select two or more adjacent polygons',
    ascii:
`Join adjacent polygons into one:

  ┌───┬───┐       ┌───────┐
  │ A │ B │  ──►  │  A+B  │
  └───┴───┘       └───────┘

  Shared edges are removed.`
  },

  generatePolygon: {
    title: 'Generate Regular Polygon',
    requires: 'none',
    requiresDescription: 'No selection (deselect all first)',
    ascii:
`Click center, drag radius:

     ╱──╲      Click: set center
    ╱    ╲     Drag:  set radius
   │  ·   │    Release: create
    ╲    ╱     Default: hexagon
     ╲──╱`
  },

  // === Alignment ===
  alignTop: {
    title: 'Align Top',
    requires: 'polygons',
    requiresDescription: 'Select two or more polygons',
    ascii:
`Align top edges of polygons:

  ══════════ reference line
  ┌──┐ ┌──┐
  │  │ │  │
  │  │ └──┘
  └──┘`
  },

  alignBottom: {
    title: 'Align Bottom',
    requires: 'polygons',
    requiresDescription: 'Select two or more polygons',
    ascii:
`Align bottom edges of polygons:

  ┌──┐
  │  │ ┌──┐
  │  │ │  │
  └──┘ └──┘
  ══════════ reference line`
  },

  alignLeft: {
    title: 'Align Left',
    requires: 'polygons',
    requiresDescription: 'Select two or more polygons',
    ascii:
`Align left edges of polygons:

  ║ ┌──┐
  ║ │  │
  ║ └──┘
  ║ ┌────┐
  ║ │    │
  ║ └────┘`
  },

  alignRight: {
    title: 'Align Right',
    requires: 'polygons',
    requiresDescription: 'Select two or more polygons',
    ascii:
`Align right edges of polygons:

    ┌──┐ ║
    │  │ ║
    └──┘ ║
  ┌────┐ ║
  │    │ ║
  └────┘ ║`
  },

  alignCenterH: {
    title: 'Center Horizontally',
    requires: 'polygons',
    requiresDescription: 'Select two or more polygons',
    ascii:
`Center polygons on shared X axis:

    ┌──┐
    │  │
    └──┘
   ┌────┐
   │    │
   └────┘
      ║ center line`
  },

  alignCenterV: {
    title: 'Center Vertically',
    requires: 'polygons',
    requiresDescription: 'Select two or more polygons',
    ascii:
`Center polygons on shared Y axis:

  ┌──┐  ┌────┐
  │  │══│    │
  └──┘  └────┘
   center line`
  },

  // === Edge Operations ===
  splitEdge: {
    title: 'Split Edge',
    requires: 'edge',
    requiresDescription: 'Select exactly one edge',
    ascii:
`Split edge at click point:

  A ─────────── B
        ↓
  A ──── · ──── B

  Click on the edge to set the
  split point.`
  },

  subdivideEdge: {
    title: 'Subdivide Edge',
    requires: 'edge',
    requiresDescription: 'Select exactly one edge',
    ascii:
`Split edge into N equal parts:

  A ──────────────── B
           ↓
  A ── · ── · ── · ── B

  Default: 3 segments`
  },

  insetEdge: {
    title: 'Inset Edge',
    requires: 'edge',
    requiresDescription: 'Select exactly one edge',
    ascii:
`Push middle section inward:

  A ────────────── B
          ↓
  A ─┐          ┌─ B
     │  inset   │
     └──────────┘`
  },

  immaterial: {
    title: 'Toggle Immaterial',
    requires: 'edge',
    requiresDescription: 'Select one or more edges',
    ascii:
`Toggle wall passability:

  Solid:      ═══════════
  Immaterial: - - - - - -

  Immaterial edges are visible
  but allow player to pass.`
  },

  texture: {
    title: 'Toggle Texture',
    requires: 'edge',
    requiresDescription: 'Select one or more edges',
    ascii:
`Toggle texture on/off:

  ┌─────────┐    ┌─────────┐
  │▓▓▓▓▓▓▓▓▓│ ↔  │         │
  │▓▓BRICK▓▓│    │ (color) │
  └─────────┘    └─────────┘`
  },

  // === Vertex Operations ===
  bevelVertex: {
    title: 'Bevel Vertex',
    requires: 'vertex',
    requiresDescription: 'Select exactly one vertex',
    ascii:
`Replace sharp corner with edge:

  │            │
  └──── V      └───╲
                    ╲──── 
  (sharp)       (beveled)`
  },

  alignVerticesH: {
    title: 'Align Vertices Horizontally',
    requires: 'vertices',
    requiresDescription: 'Select two or more vertices',
    ascii:
`Move vertices to same Y:

  ·              ·─────·
     ·    ──►
        ·
  (scattered)  (aligned Y)`
  },

  alignVerticesV: {
    title: 'Align Vertices Vertically',
    requires: 'vertices',
    requiresDescription: 'Select two or more vertices',
    ascii:
`Move vertices to same X:

  ·              ·
     ·    ──►    ·
        ·        ·
  (scattered)  (aligned X)`
  },

  weldVertices: {
    title: 'Weld Vertices',
    requires: 'vertices',
    requiresDescription: 'Select two or more vertices',
    ascii:
`Merge nearby vertices together:

  ·  ·           ·
     ·    ──►
  ·              ·

  Moves to average position.`
  },

  // === Misc ===
  remove: {
    title: 'Remove',
    requires: 'any',
    requiresDescription: 'Select geometry to remove',
    ascii:
`Delete selected geometry:

  ┌───┐
  │ X │  ──►   (removed)
  └───┘`
  },

  fadeStrategy: {
    title: 'Adapt Fading Strategy',
    requires: 'any',
    requiresDescription: 'Any selection',
    ascii:
`Cycle distance fade mode:

  ████▓▓▓▒▒▒░░░
  near ──────► far

  Changes how walls fade
  with distance.`
  },

  bsp: {
    title: 'Recalculate BSP',
    requires: 'none',
    requiresDescription: 'Always available',
    ascii:
`Rebuild the BSP tree:

     ╱
    ╱ front
   ╱──────
   ╲ back
    ╲
     ╲

  Required after editing.`
  },
};

export default tooltips;
