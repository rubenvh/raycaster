import { createListenerMiddleware } from '@reduxjs/toolkit';
import { RootState } from './index';
import { IGeometry } from '../geometry/geometry';
import { IEdge } from '../geometry/edge';
import { IPolygon } from '../geometry/polygon';
import { IEntityKey } from '../geometry/entity';
import { IEdgeDiff, EMPTY_DIFF } from '../geometry/bsp/dirty-edge-tracker';
import { IBSPNode, isLeafNode, isSplitNode } from '../geometry/bsp/model';
import { markDirty } from './bsp-state';
import { IMaterial } from '../geometry/properties';

/**
 * Returns true if two edges have identical vertex positions.
 * Used to distinguish edges that were cloned but not moved from edges
 * whose vertices actually changed (e.g., a vertex drag).
 */
function verticesMatch(oldEdge: IEdge, newEdge: IEdge): boolean {
    return oldEdge.start.vector[0] === newEdge.start.vector[0]
        && oldEdge.start.vector[1] === newEdge.start.vector[1]
        && oldEdge.end.vector[0] === newEdge.end.vector[0]
        && oldEdge.end.vector[1] === newEdge.end.vector[1];
}

/**
 * Returns true if two edges have different non-spatial properties (material, immaterial).
 * When BSP state is separated from geometry, the BSP tree holds stale edge references.
 * Material/immaterial changes must be tracked so the renderer uses current geometry
 * edges instead of the stale BSP copies.
 */
function nonSpatialPropertiesChanged(oldEdge: IEdge, newEdge: IEdge): boolean {
    if (oldEdge.immaterial !== newEdge.immaterial) return true;
    return !materialsEqual(oldEdge.material, newEdge.material);
}

/** Shallow comparison of directed materials. */
function materialsEqual(a: IEdge['material'], b: IEdge['material']): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    // Both are arrays (directed) or both are single materials
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr !== bArr) return false;
    if (aArr && bArr) {
        return singleMaterialEquals(a[0], b[0]) && singleMaterialEquals(a[1], b[1]);
    }
    return singleMaterialEquals(a as any, b as any);
}

/** Compare two single IMaterial objects. */
function singleMaterialEquals(a: {color: number[], texture?: any, luminosity?: number} | null, 
                               b: {color: number[], texture?: any, luminosity?: number} | null): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    const ca = a.color, cb = b.color;
    if (ca[0] !== cb[0] || ca[1] !== cb[1] || ca[2] !== cb[2] || ca[3] !== cb[3]) return false;
    // Texture comparison (reference or structural)
    if (a.texture !== b.texture) {
        if (a.texture == null || b.texture == null) return false;
        if (a.texture.id !== b.texture.id || a.texture.index !== b.texture.index) return false;
    }
    return true;
}

/**
 * Returns true if two polygons have different floor/ceiling surface materials.
 */
function polygonSurfacesChanged(oldPoly: IPolygon, newPoly: IPolygon): boolean {
    if (!singleMaterialEquals(oldPoly.floorMaterial ?? null, newPoly.floorMaterial ?? null)) return true;
    if (!singleMaterialEquals(oldPoly.ceilingMaterial ?? null, newPoly.ceilingMaterial ?? null)) return true;
    return false;
}

/**
 * Walks the BSP tree and patches material/immaterial properties in-place on BSP edge
 * objects whose IDs match entries in the materialPatches map.
 * 
 * This is a pragmatic Redux immutability violation: we mutate BSP edge objects directly
 * rather than rebuilding the tree or overlaying a material map. This is safe because:
 * 1. The BSP tree structure (splitting planes, polygon membership) is unchanged
 * 2. Material changes only update existing materials (never null→non-null), so
 *    null-check gates in renderers (`e.material == null`) remain correct
 * 3. No Redux selector depends on edge material identity within the BSP tree
 * 
 * @param tree - The BSP tree root node
 * @param materialPatches - Map from edge ID to the new geometry edge with updated material/immaterial
 */
export function patchBspEdgeMaterials(tree: IBSPNode, materialPatches: Map<IEntityKey, IEdge>): void {
    if (materialPatches.size === 0) return;

    /**
     * Patch edges within a polygons array. If any polygon or edge is frozen
     * (e.g., because a BSP reference was stored in an Immer-managed slice like
     * selection), creates mutable shallow copies as needed.
     * Returns the same array if no patches were needed, or a new array with
     * patched polygons substituted.
     */
    function patchPolygons(polygons: IPolygon[]): IPolygon[] {
        let result = polygons;
        for (let pi = 0; pi < result.length; pi++) {
            let poly = result[pi];
            let edges = poly.edges;
            let polyThawed = false;
            for (let ei = 0; ei < edges.length; ei++) {
                const edge = edges[ei];
                if (edge.id == null) continue;
                const newEdge = materialPatches.get(edge.id);
                if (newEdge != null) {
                    // Thaw frozen containers on demand (outermost first).
                    // This handles the case where a BSP edge/polygon reference was
                    // stored in an Immer-managed slice (e.g., selection), causing
                    // Immer to deep-freeze the object graph through the shared ref.
                    if (!polyThawed && (Object.isFrozen(poly) || Object.isFrozen(edges))) {
                        if (Object.isFrozen(result)) {
                            result = [...result];
                        }
                        edges = [...edges];
                        poly = { ...poly, edges } as IPolygon;
                        result[pi] = poly;
                        polyThawed = true;
                    }
                    if (Object.isFrozen(edge)) {
                        edges[ei] = { ...edge, material: newEdge.material, immaterial: newEdge.immaterial };
                    } else {
                        edge.material = newEdge.material;
                        edge.immaterial = newEdge.immaterial;
                    }
                }
            }
        }
        return result;
    }

    function walkTree(node: IBSPNode): void {
        if (isLeafNode(node)) {
            const patched = patchPolygons(node.polygons);
            if (patched !== node.polygons) {
                (node as any).polygons = patched;
            }
        } else if (isSplitNode(node)) {
            walkTree(node.front);
            const patched = patchPolygons(node.coplanar);
            if (patched !== node.coplanar) {
                (node as any).coplanar = patched;
            }
            walkTree(node.back);
        }
    }

    walkTree(tree);
}

/**
 * Walks the BSP tree and patches floor/ceiling materials in-place on BSP polygon
 * objects whose IDs match entries in the surfacePatches map.
 * 
 * This follows the same pragmatic mutation approach as patchBspEdgeMaterials:
 * the BSP spatial structure is unchanged, we're only updating polygon surface
 * materials so the renderer sees current values during BSP walk.
 * 
 * @param tree - The BSP tree root node
 * @param surfacePatches - Map from polygon ID to { floorMaterial, ceilingMaterial }
 */
export function patchBspPolygonSurfaces(
    tree: IBSPNode, 
    surfacePatches: Map<IEntityKey, { floorMaterial?: IMaterial, ceilingMaterial?: IMaterial }>
): void {
    if (surfacePatches.size === 0) return;

    function patchPolygons(polygons: IPolygon[]): void {
        for (let pi = 0; pi < polygons.length; pi++) {
            let poly = polygons[pi];
            if (poly.id == null) continue;
            const patch = surfacePatches.get(poly.id);
            if (patch == null) continue;

            if (Object.isFrozen(poly)) {
                poly = { ...poly };
                if (Object.isFrozen(polygons)) {
                    polygons = [...polygons];
                }
                polygons[pi] = poly;
            }
            poly.floorMaterial = patch.floorMaterial;
            poly.ceilingMaterial = patch.ceilingMaterial;
        }
    }

    function walkTree(node: IBSPNode): void {
        if (isLeafNode(node)) {
            patchPolygons(node.polygons);
        } else if (isSplitNode(node)) {
            walkTree(node.front);
            patchPolygons(node.coplanar);
            walkTree(node.back);
        }
    }

    walkTree(tree);
}

/**
 * Result of computing edge diffs, separating spatial changes from material-only changes.
 */
export interface IEdgeDiffResult {
    /** Edges with spatial (vertex) changes, additions, or removals — requires BSP rebuild */
    spatialDiff: IEdgeDiff;
    /** Edges with only material/immaterial changes (same vertices) — can be patched in-place */
    materialOnlyEdges: Map<IEntityKey, IEdge>;
    /** Polygons with only floor/ceiling material changes — can be patched in-place */
    surfaceOnlyPolygons: Map<IEntityKey, { floorMaterial?: IMaterial, ceilingMaterial?: IMaterial }>;
}

export const EMPTY_DIFF_RESULT: IEdgeDiffResult = {
    spatialDiff: EMPTY_DIFF,
    materialOnlyEdges: new Map(),
    surfaceOnlyPolygons: new Map(),
};

/**
 * Computes an edge diff between old and new geometry using a two-tier approach:
 * 
 * **Tier 1 — Polygon reference equality:**
 * Polygons that are the same JS reference (===) in both old and new geometry
 * are skipped entirely. This works because adaptPolygons/forkPolygons/addPolygon
 * preserve unchanged polygon objects by reference.
 * 
 * **Tier 2 — Edge comparison (within changed polygons only):**
 * For polygons that changed (different reference or different ID set), compare
 * each edge's vertex positions AND non-spatial properties (material, immaterial).
 * 
 * Results are separated into two categories:
 * - **Spatial changes** (vertex moved, edge added/removed): require BSP rebuild
 * - **Material-only changes** (same vertices, different material/immaterial): 
 *   can be patched in-place on BSP edge objects without a rebuild
 */
function computeEdgeDiff(oldGeometry: IGeometry, newGeometry: IGeometry): IEdgeDiffResult {
    // Quick identity check — if the geometry object is the same reference, 
    // no mutation occurred (e.g., undo to same state, or no-op operations).
    if (oldGeometry === newGeometry) return EMPTY_DIFF_RESULT;

    // Tier 1: Build polygon lookup for old geometry
    const oldPolygonMap = new Map<IEntityKey, IPolygon>();
    for (const p of oldGeometry.polygons) {
        if (p.id != null) oldPolygonMap.set(p.id, p);
    }

    const removedEdgeIds = new Set<IEntityKey>();
    const addedEdgeIds = new Set<IEntityKey>();
    const modifiedEdgeIds = new Set<IEntityKey>();
    const materialOnlyEdges = new Map<IEntityKey, IEdge>();
    const surfaceOnlyPolygons = new Map<IEntityKey, { floorMaterial?: IMaterial, ceilingMaterial?: IMaterial }>();
    const seenOldPolygonIds = new Set<IEntityKey>();

    for (const newPoly of newGeometry.polygons) {
        const oldPoly = newPoly.id != null ? oldPolygonMap.get(newPoly.id) : undefined;

        if (oldPoly === newPoly) {
            // Tier 1: Same reference — polygon is completely unchanged, skip all edges
            if (newPoly.id != null) seenOldPolygonIds.add(newPoly.id);
            continue;
        }

        if (oldPoly != null) {
            // Polygon was mutated (same ID, different reference)
            // Tier 2: Compare individual edge vertices
            seenOldPolygonIds.add(newPoly.id!);

            // Check for polygon surface material changes (floor/ceiling)
            if (polygonSurfacesChanged(oldPoly, newPoly)) {
                surfaceOnlyPolygons.set(newPoly.id!, {
                    floorMaterial: newPoly.floorMaterial,
                    ceilingMaterial: newPoly.ceilingMaterial,
                });
            }

            const oldEdgeMap = new Map<IEntityKey, IEdge>();
            for (const e of oldPoly.edges) {
                if (e.id != null) oldEdgeMap.set(e.id, e);
            }

            for (const e of newPoly.edges) {
                if (e.id != null) {
                    const oldEdge = oldEdgeMap.get(e.id);
                    if (oldEdge != null) {
                        oldEdgeMap.delete(e.id);
                        if (!verticesMatch(oldEdge, e)) {
                            // Vertices moved → spatial change, requires BSP rebuild
                            modifiedEdgeIds.add(e.id);
                        } else if (nonSpatialPropertiesChanged(oldEdge, e)) {
                            // Same vertices, different material/immaterial → patch in-place
                            materialOnlyEdges.set(e.id, e);
                        }
                    } else {
                        addedEdgeIds.add(e.id);
                    }
                }
            }

            // Old edges not found in new polygon → removed
            for (const id of oldEdgeMap.keys()) {
                removedEdgeIds.add(id);
            }
        } else {
            // Polygon not in old geometry → all its edges are new
            for (const e of newPoly.edges) {
                if (e.id != null) addedEdgeIds.add(e.id);
            }
        }
    }

    // Old polygons not seen in new geometry → all their edges removed
    for (const [oldId, oldPoly] of oldPolygonMap) {
        if (!seenOldPolygonIds.has(oldId)) {
            for (const e of oldPoly.edges) {
                if (e.id != null) removedEdgeIds.add(e.id);
            }
        }
    }

    const hasSpatialChanges = removedEdgeIds.size > 0 || addedEdgeIds.size > 0 || modifiedEdgeIds.size > 0;
    const spatialDiff = hasSpatialChanges
        ? { removedEdgeIds, addedEdgeIds, modifiedEdgeIds }
        : EMPTY_DIFF;

    if (spatialDiff === EMPTY_DIFF && materialOnlyEdges.size === 0 && surfaceOnlyPolygons.size === 0) {
        return EMPTY_DIFF_RESULT;
    }

    return { spatialDiff, materialOnlyEdges, surfaceOnlyPolygons };
}

/**
 * Walls actions that should trigger BSP dirty tracking.
 * We match any action starting with 'walls/' except:
 * - 'walls/loadWalls' — full geometry replacement; the caller (loadWorld)
 *   dispatches setBsp() directly, which either sets a loaded BSP ('fresh')
 *   or sets null ('none', triggering BspGenerationService auto-generation).
 */
const WALLS_PREFIX = 'walls/';
const LOAD_WALLS_TYPE = 'walls/loadWalls';

/**
 * Walls actions that are geometry mutations (not undo/redo/load).
 * Undo/redo also change geometry, so they also need diff computation.
 */
function isWallsMutationAction(action: { type: string }): boolean {
    return action.type.startsWith(WALLS_PREFIX) && action.type !== LOAD_WALLS_TYPE;
}

/**
 * Creates the BSP listener middleware.
 * 
 * Listens for all walls slice mutations and computes edge diffs between
 * old and new geometry. Two paths:
 * 
 * 1. **Spatial changes** (vertex moved, edge added/removed): dispatches markDirty
 *    to bspState, which transitions status to 'stale' and triggers an async rebuild.
 * 
 * 2. **Material-only changes** (same vertices, different material/immaterial): 
 *    patches BSP edge objects in-place via patchBspEdgeMaterials. No markDirty,
 *    no status change, no rebuild needed. The BSP spatial structure is unchanged.
 * 
 * Both paths can fire for mixed changes (some edges moved + some material-only).
 * 
 * loadWalls is excluded — it replaces geometry wholesale, and the caller
 * (loadWorld in stateLoader.ts) dispatches setBsp() to set the BSP state
 * directly. setBsp(tree) sets status 'fresh'; setBsp(null) sets status
 * 'none', which triggers BspGenerationService to auto-generate.
 */
export const bspListenerMiddleware = createListenerMiddleware();

// Handle all walls mutations (except loadWalls): compute edge diff
bspListenerMiddleware.startListening({
    predicate: isWallsMutationAction,
    effect: async (_action, listenerApi) => {
        const currentState = listenerApi.getState() as RootState;
        const originalState = listenerApi.getOriginalState() as RootState;

        const oldGeometry = originalState.walls.geometry;
        const newGeometry = currentState.walls.geometry;

        const result = computeEdgeDiff(oldGeometry, newGeometry);

        if (result === EMPTY_DIFF_RESULT) return;

        // Path 1: Spatial changes → dispatch markDirty for BSP rebuild
        if (result.spatialDiff !== EMPTY_DIFF) {
            listenerApi.dispatch(markDirty(result.spatialDiff));
        }

        // Path 2: Material-only changes → patch BSP edges in-place
        if (result.materialOnlyEdges.size > 0) {
            const bspTree = currentState.bsp.treeHolder?.node ?? null;
            if (bspTree != null) {
                patchBspEdgeMaterials(bspTree, result.materialOnlyEdges);
            }
        }

        // Path 3: Surface-only changes → patch BSP polygon floor/ceiling materials in-place
        if (result.surfaceOnlyPolygons.size > 0) {
            const bspTree = currentState.bsp.treeHolder?.node ?? null;
            if (bspTree != null) {
                patchBspPolygonSurfaces(bspTree, result.surfaceOnlyPolygons);
            }
        }
    },
});
