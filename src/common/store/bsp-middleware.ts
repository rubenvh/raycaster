import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { RootState } from './index';
import { IGeometry } from '../geometry/geometry';
import { IEdge } from '../geometry/edge';
import { IPolygon } from '../geometry/polygon';
import { IEntityKey } from '../geometry/entity';
import { IEdgeDiff, EMPTY_DIFF } from '../geometry/bsp/dirty-edge-tracker';
import { markDirty } from './bsp-state';

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
 * Edges whose vertices moved are marked as "modified" for spatial re-indexing.
 * Edges whose vertices are unchanged but whose material/immaterial changed are
 * also marked as "modified" so the renderer uses the current geometry's edge
 * instead of the stale BSP copy. (The BSP tree holds references to old edge
 * objects; without marking these dirty, the renderer would display old materials.)
 */
function computeEdgeDiff(oldGeometry: IGeometry, newGeometry: IGeometry): IEdgeDiff {
    // Quick identity check — if the geometry object is the same reference, 
    // no mutation occurred (e.g., undo to same state, or no-op operations).
    if (oldGeometry === newGeometry) return EMPTY_DIFF;

    // Tier 1: Build polygon lookup for old geometry
    const oldPolygonMap = new Map<IEntityKey, IPolygon>();
    for (const p of oldGeometry.polygons) {
        if (p.id != null) oldPolygonMap.set(p.id, p);
    }

    const removedEdgeIds = new Set<IEntityKey>();
    const addedEdgeIds = new Set<IEntityKey>();
    const modifiedEdgeIds = new Set<IEntityKey>();
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

            const oldEdgeMap = new Map<IEntityKey, IEdge>();
            for (const e of oldPoly.edges) {
                if (e.id != null) oldEdgeMap.set(e.id, e);
            }

            for (const e of newPoly.edges) {
                if (e.id != null) {
                    const oldEdge = oldEdgeMap.get(e.id);
                    if (oldEdge != null) {
                        oldEdgeMap.delete(e.id);
                        // Mark modified if vertices moved OR non-spatial properties changed.
                        // Vertex moves invalidate BSP spatial indexing; material/immaterial
                        // changes require the renderer to use the current edge instead of
                        // the stale BSP copy.
                        if (!verticesMatch(oldEdge, e) || nonSpatialPropertiesChanged(oldEdge, e)) {
                            modifiedEdgeIds.add(e.id);
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

    if (removedEdgeIds.size === 0 && addedEdgeIds.size === 0 && modifiedEdgeIds.size === 0) {
        return EMPTY_DIFF;
    }

    return { removedEdgeIds, addedEdgeIds, modifiedEdgeIds };
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
 * old and new geometry. Dispatches markDirty to bspState when edges change.
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

        const diff = computeEdgeDiff(oldGeometry, newGeometry);

        // Only dispatch if there's an actual diff
        if (diff !== EMPTY_DIFF) {
            listenerApi.dispatch(markDirty(diff));
        }
    },
});
