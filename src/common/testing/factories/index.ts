/**
 * Test data factories for the raycaster project.
 * 
 * These factories use the Fishery library to generate test data with sensible defaults.
 * You can override specific properties that matter for your test while getting random
 * values for everything else.
 * 
 * @example
 * // Basic usage - get random defaults
 * const edge = edgeFactory.build();
 * 
 * @example
 * // Override specific properties
 * const edge = edgeFactory.opaque().build();
 * 
 * @example
 * // Use convenience helpers
 * const poly = polygons.triangle([0,0], [100,0], [50,100]);
 * 
 * @example
 * // Reset random seed for reproducibility
 * import { resetTestRandom } from '../seeded-random';
 * beforeEach(() => resetTestRandom());
 */

// Re-export the seeded random utilities
export { SeededRandom, testRandom, resetTestRandom } from '../seeded-random';

// Vertex factory
export { vertexFactory, buildVertexPath } from './vertex.factory';

// Material factory
export { 
    materialFactory, 
    directedMaterialFactory, 
    COLORS 
} from './material.factory';

// Edge factory
export { 
    edgeFactory, 
    edges, 
    buildEdgeLoop 
} from './edge.factory';

// Polygon factory
export { 
    polygonFactory, 
    polygons 
} from './polygon.factory';

// Camera factory
export { 
    cameraFactory, 
    cameras 
} from './camera.factory';

// Geometry factory
export { 
    geometryFactory, 
    geometries 
} from './geometry.factory';
