import { selectPolygon } from './../selection/selectable';

import * as vector from '../math/vector';
import * as collision from './collision';
import { IEdge, cloneEdge, duplicateEdge, makeEdge, createEdges, loadEdge } from './edge';
import { IEntity, giveIdentity, IEntityKey, createEntityKey, cloneKey } from './entity';
import { BoundingBox, createPolygon, IPolygon, IStoredPolygon, loadPolygon, contains, containsVertex, containsEdge, centerOf, merge, storePolygon, signedArea } from './polygon';
import { lineIntersect, distanceTo, segmentLength } from '../math/lineSegment';
import { SingleSelectableElement, selectEdge, selectVertex } from '../selection/selectable';
import { areEqual, areClose, IVertex, IVertexMap, makeVertex } from './vertex';
import { cloneMaterial, cloneSimpleMaterial } from './properties';

export type IStoredGeometry = IEntity & { polygons: IStoredPolygon[]};
export type IGeometry = IEntity & { polygons: IPolygon[], edgeCount: number, bounds: vector.Vector};
export const EMPTY_GEOMETRY: IGeometry = {polygons: [], edgeCount: 0, bounds: [0,0]};
export const storeGeometry = (g: IGeometry): IStoredGeometry => ({id: g.id, polygons: g.polygons.map(storePolygon)});
export const loadGeometry = (g : IStoredGeometry): IGeometry => {
    const polygons = g.polygons.map(loadPolygon);
    return ({id: g.id, polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons)});
};
export const createGeometry = (polygonCollection: vector.Vector[][]): IGeometry => {
    const polygons = polygonCollection.map(createPolygon);
    return ({polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons)});
};
export const addPolygon = (p: IPolygon, geometry: IGeometry): IGeometry => ({...geometry, 
    polygons: [...geometry.polygons, p], edgeCount: geometry.edgeCount+1});
const countEdges = (ps : IPolygon[]): number => ps.reduce((acc, p) => acc + p.edgeCount, 0);
const findBounds = (ps : IPolygon[]): vector.Vector => ps.reduce((acc, p) => vector.maximumComponents(acc, p.boundingBox[1]), [0,0] as vector.Vector);
export const detectCollisionAt = (vector: vector.Vector, geometry: IGeometry): collision.Collision => {
    return collision.detectCollisionAt(vector, geometry.polygons);    
}

const forkPolygons = (ids: IEntityKey[], geometry: IGeometry, polygonSplitter: (poligon: IPolygon)=>IEdge[][]) : IGeometry => {
    
    let [unchanged, adapted]: [IPolygon[], IPolygon[]] = geometry.polygons.reduce((acc, p) => {
        acc[+ids.includes(p.id)].push(p);
        return acc;
    }, [[],[]]);

    let polygonIdsUsed = [];
    let adaptedPolygons = adapted
        .map(p => ({p, edgeSets: polygonSplitter(p)}))        
        .reduce((acc, _) => acc.concat(..._.edgeSets.map(s => {
            const key = (acc.some(p => p.id === _.p.id) || polygonIdsUsed.includes(_.p.id)) ? createEntityKey() : cloneKey(_.p.id);
            polygonIdsUsed.push(key);
            const loaded = loadPolygon({ id: key, edges: s});
            // Propagate floor/ceiling materials from the source polygon
            loaded.floorMaterial = cloneSimpleMaterial(_.p.floorMaterial);
            loaded.ceilingMaterial = cloneSimpleMaterial(_.p.ceilingMaterial);
            return loaded;
        })), [] as IPolygon[]);

    const polygons = [...unchanged, ...adaptedPolygons];
    return ({...geometry, polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons)});
};

const adaptPolygons = (ids: IEntityKey[], geometry: IGeometry, edgeTransformer: (poligon: IPolygon)=>IEdge[]) => {    
    return forkPolygons(ids, geometry, (p)=>[edgeTransformer(p)]);    
};


export const splitEdge = (cut: vector.Vector, edge: IEdge, poligon: IEntityKey, geometry: IGeometry) => {
    return adaptPolygons([poligon], geometry, (selectedPolygon) => {
        return selectedPolygon.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (e.id === edge.id) {
                const newEnd = e.end;
                e.end = makeVertex(cut);
                const newEdge: IEdge = loadEdge({start: e.end, end: newEnd, immaterial: e.immaterial, material: cloneMaterial(e.material)});
                return acc.concat(e, newEdge);
            }
            return acc.concat(e);
        }, [])
    });
}

export const moveVertices = (isSnapping: boolean, delta: vector.Vector, map: IVertexMap, geometry: IGeometry): IGeometry => {
    const doSnap = (v: vector.Vector) => isSnapping ? vector.snap(v) : v;
    return adaptPolygons(Array.from(map.keys()), geometry, p => {
        const vertices = [...map.get(p.id)];
        const moveVertex = (v: IVertex) => {
            const index = vertices.findIndex(_ => _.id === v.id);
            if (index >= 0) { 
                vector.copyIn(v.vector, doSnap(vector.add(v.vector, delta)));
            }
        };
        return p.edges.map(e=>cloneEdge(e)).reduce((acc, e) => {
            moveVertex(e.start);
            moveVertex(e.end);            
            return acc.concat(e);
        }, [])
    });
};

export const removeVertex = (vertex: IVertex, poligon: IEntityKey, geometry: IGeometry) => {    
    const result = adaptPolygons([poligon], geometry, (selectedPolygon) => {
        const {edges} = selectedPolygon.edges.map(e=>cloneEdge(e)).reduce((acc, e)=> {                
            if (vertex.id === e.start.id && vertex.id === e.end.id) { // removing last vertex in an empty polygon
                return acc;
            } else if (e.end.id === vertex.id && acc.lastEnd) { // first vertex in polygon was removed and we arrive at the last edge
                e.end = acc.lastEnd;
                acc.edges.push(e);
            }
            else if (e.end.id === vertex.id) {  // edge end vertex is removed => store for next iteration to reassign end vertex 
                acc.previous = e;
                acc.edges.push(e);            
            } else if (acc.previous && e.start.id === vertex.id) { // ignore this edge and reassign previous end 
                acc.previous.end = e.end;            
            } else if (e.start.id === vertex.id) { // removing the start of the first edge, keep end until last edge
                acc.lastEnd = e.end;
            } else {
                acc.edges.push(e);
            }        
            return acc;  
            }, 
            {edges: [], previous: null as IEdge, lastEnd: null as IVertex})
        return edges;
    });

    return {...result, polygons: result.polygons.filter(_=>_.edgeCount > 0) };
};

export const selectRegion = (region: BoundingBox, geometry: IGeometry): SingleSelectableElement[] => {
    const ps = geometry.polygons.filter(p => contains(region, p.boundingBox));
    const [vs, es] = geometry.polygons.filter(p => !ps.includes(p)).reduce((acc, p) => ([
        [...acc[0], ...p.vertices.filter(v => containsVertex(v, region)).map(v => selectVertex(v, p))],
        [...acc[1], ...p.edges.filter(v => containsEdge(v, region)).map(e => selectEdge(e, p))]]), [[], []]);

    return [...ps.map(p => selectPolygon(p)),
            ...es, ...vs,
    ];
};

export const duplicatePolygons = (poligons: IPolygon[], delta: vector.Vector, geometry: IGeometry): [IGeometry, IPolygon[]] => {
    const newPoligons = poligons.map(p => {
        const loaded = loadPolygon(giveIdentity<IStoredPolygon>({edges: p.edges.map(e => duplicateEdge(e, delta))}));
        loaded.floorMaterial = cloneSimpleMaterial(p.floorMaterial);
        loaded.ceilingMaterial = cloneSimpleMaterial(p.ceilingMaterial);
        return loaded;
    });
    return [
        {...geometry, polygons: [...geometry.polygons, ...newPoligons]},
        newPoligons];
};

export const transformEdges = (edges: IEdge[], poligonId: IEntityKey, transformer: (_: IEdge) => IEdge, geometry: IGeometry): IGeometry => {
    return adaptPolygons([poligonId], geometry, p => p.edges
        .map(e => cloneEdge(e))
        .reduce((acc, e) => acc.concat(edges.some(_ => e.id === _.id) ? transformer(e) : e), []));
};

export const expandPolygon = (edge: IEdge | null, poligonId: IEntityKey, target: vector.Vector, geometry: IGeometry): [IPolygon, IGeometry] => {
    const result = adaptPolygons([poligonId], geometry, p => {
        const n = p.edges.length;
        if (n < 3) return p.edges.map(e => cloneEdge(e));

        // If no edge was provided, use the polygon edge nearest to the target
        const refEdge = edge ?? p.edges.reduce((closest, e) => {
            const dist = distanceTo(target, e.segment);
            return dist < closest.dist ? { edge: e, dist } : closest;
        }, { edge: p.edges[0], dist: Infinity }).edge;

        // Determine the offset distance as the signed perpendicular distance
        // from the target point to the reference edge's line.
        const edgeDir = vector.subtract(refEdge.end.vector, refEdge.start.vector);
        const edgeLen = vector.norm(edgeDir);
        if (edgeLen === 0) return p.edges.map(e => cloneEdge(e));

        // Determine winding to know which side is "outward"
        // For a CCW polygon (positive area), the outward normal is the CW rotation
        // of the edge direction: [dy, -dx]. We use windingSign = -1 for CCW so that
        // the formula [-nd[1]*windingSign, nd[0]*windingSign] yields [nd[1], -nd[0]].
        const area = signedArea(p);
        const windingSign = area >= 0 ? -1 : 1;

        // Outward normal for the selected edge
        const edgeNormDir = vector.normalize(edgeDir);
        const edgeOutwardNormal: vector.Vector = [
            -edgeNormDir[1] * windingSign,
             edgeNormDir[0] * windingSign,
        ];

        // Signed distance from target to the selected edge line (positive = outward)
        const targetToEdgeStart = vector.subtract(target, refEdge.start.vector);
        const d = vector.dot(targetToEdgeStart, edgeOutwardNormal);

        // Compute outward normals for all edges
        const normals: vector.Vector[] = p.edges.map(e => {
            const dir = vector.subtract(e.end.vector, e.start.vector);
            const len = vector.norm(dir);
            if (len === 0) return [0, 0] as vector.Vector;
            const nd = vector.normalize(dir);
            return [-nd[1] * windingSign, nd[0] * windingSign] as vector.Vector;
        });

        // Offset each edge: shift both endpoints along their outward normal by d
        const offsetEdges: [vector.Vector, vector.Vector][] = p.edges.map((e, i) => {
            const offset = vector.scale(d, normals[i]);
            return [
                vector.add(e.start.vector, offset),
                vector.add(e.end.vector, offset),
            ];
        });

        // Compute new vertices as intersections of adjacent offset edge lines
        const newVertices: vector.Vector[] = [];
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const lineA = offsetEdges[i];
            const lineB = offsetEdges[j];

            // Check if the two offset edges are parallel
            const dirA = vector.subtract(lineA[1], lineA[0]);
            const dirB = vector.subtract(lineB[1], lineB[0]);
            const crossVal = vector.cross(dirA, dirB);

            if (Math.abs(crossVal) < 1e-10) {
                // Parallel edges: use the offset endpoint directly
                newVertices.push(lineA[1]);
            } else {
                // Intersect the two infinite lines
                const intersection = lineIntersect(lineA, lineB);
                newVertices.push(intersection);
            }
        }

        // Build new edges from the computed vertices, preserving materials
        // newVertices[i] is the intersection of offset edges i and i+1,
        // which is the end vertex of edge i / start vertex of edge i+1.
        return p.edges.map((originalEdge, i) => {
            const start = newVertices[(i - 1 + n) % n];
            const end = newVertices[i];
            return {
                ...makeEdge(start, end),
                material: cloneMaterial(originalEdge.material),
                immaterial: originalEdge.immaterial,
            } as IEdge;
        });
    });

    return [result.polygons.find(p => p.id === poligonId), result];    
}

export const rotatePolygon = (polygonIds: IEntityKey[], target: vector.Vector, geometry: IGeometry, center?: vector.Vector): IGeometry => {
    const polygons = geometry.polygons.filter(x => polygonIds.includes(x.id));
    const rotationCenter = center ?? centerOf(polygons.slice(1).reduce((acc, p) => merge(acc, p.boundingBox), polygons[0].boundingBox));
    // Find a reference vertex that is not coincident with the rotation center.
    // If all vertices coincide with the center (degenerate), fall back to the first vertex.
    const allVertices = polygons.flatMap(p => p.vertices);
    const reference = (allVertices.find(v => vector.distance(v.vector, rotationCenter) > 0.001) ?? allVertices[0]).vector;
    return adaptPolygons(polygonIds, geometry, p => {        
        const centerToTarget = vector.subtract(target, rotationCenter);
        const centerToReference = vector.subtract(reference, rotationCenter);
        const angle = -1 * vector.angleBetween(centerToTarget, centerToReference);
        const edges = createEdges(p.vertices
                .map(v => vector.subtract(v.vector, rotationCenter))
                .map(u => vector.add(rotationCenter, vector.rotate(angle, u))));
        return edges
            .map((e, i) => ({newEdge: e, basedOn: p.edges[i] }))
            .map(_ => ({..._.newEdge, immaterial: _.basedOn?.immaterial ?? false, material: _.basedOn && cloneMaterial(_.basedOn.material) || _.newEdge.material }));;
    });
}

export const splitPolygon = (v1: IVertex, v2: IVertex, poligonId: IEntityKey, geometry: IGeometry): IGeometry => {
    const result = forkPolygons([poligonId], geometry, p => {   
        // find indices of splitting vertices
        let i = p.vertices.findIndex(v => areEqual(v, v1));
        let j = p.vertices.findIndex(v => areEqual(v, v2));

        // make sure they are in small to large order
        if (i > j) {
            const temp = i;
            i = j;
            j = temp;
        }

        // utility function to create edges (copying material) for a list of vertices
        const create = (vs: IVertex[]): IEdge[] => createEdges(vs.map(v => v.vector))
            .map(e => ({newEdge: e, basedOn: p.edges.find(_ => areEqual(_.start, e.start)) }))
            .map(_ => ({..._.newEdge, immaterial: _.basedOn?.immaterial ?? false, material: _.basedOn && cloneMaterial(_.basedOn.material) || _.newEdge.material }));
        
        // create 2 new polygons and return them
        const p1 = create(p.vertices.slice(0, i+1).concat(p.vertices.slice(j)));
        const p2 = create(p.vertices.slice(i, j+1));
        return [p1, p2];
    });

    return result;   
}

export const reversePolygon = (polygonIds: IEntityKey[], geometry: IGeometry): IGeometry => {    
    return adaptPolygons(polygonIds, geometry, p => {        
        const edges = createEdges([p.vertices[0], ...p.vertices.slice(1).reverse()]
                .map(v => v.vector));
        return edges
            .map((e, i) => ({newEdge: e, basedOn: p.edges[p.edges.length-(i+1)] }))
            .map(_ => ({..._.newEdge, immaterial: _.basedOn?.immaterial ?? false, material: _.basedOn && cloneMaterial(_.basedOn.material) || _.newEdge.material }));;
    });
}

export const queryVertex = (vertexId : IEntityKey, polygonId: IEntityKey, geometry: IGeometry): IVertex => {
    return geometry.polygons.find(_ => _.id === polygonId).vertices.find(_ => _.id === vertexId);
}
export const queryEdge = (edgeId : IEntityKey, polygonId: IEntityKey, geometry: IGeometry): IEdge => {
    return geometry.polygons.find(_ => _.id === polygonId).edges.find(_ => _.id === edgeId);
}
export const queryPolygon = (polygonId: IEntityKey, geometry: IGeometry): IPolygon => {
    return geometry.polygons.find(_ => _.id === polygonId);
}

// ============================================================================
// 1. Subdivide Edge
// Splits an edge into N equal segments by inserting N-1 evenly-spaced vertices.
// ============================================================================
export const subdivideEdge = (edge: IEdge, poligonId: IEntityKey, segments: number, geometry: IGeometry): IGeometry => {
    if (segments < 2) return geometry;
    return adaptPolygons([poligonId], geometry, p => {
        return p.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (e.id !== edge.id) return acc.concat(e);
            const s = e.start.vector;
            const d = e.end.vector;
            const points: vector.Vector[] = [s];
            for (let i = 1; i < segments; i++) {
                const t = i / segments;
                points.push([s[0] + t * (d[0] - s[0]), s[1] + t * (d[1] - s[1])]);
            }
            points.push(d);
            const result: IEdge[] = [];
            for (let i = 0; i < points.length - 1; i++) {
                result.push({
                    ...makeEdge(points[i], points[i + 1]),
                    material: cloneMaterial(e.material),
                    immaterial: e.immaterial,
                } as IEdge);
            }
            return acc.concat(result);
        }, [] as IEdge[]);
    });
};

// ============================================================================
// 2. Extrude Edge
// Pushes a single edge outward, creating a rectangular extrusion with two side
// edges and a new front edge.
// ============================================================================
export const extrudeEdge = (edge: IEdge, poligonId: IEntityKey, target: vector.Vector, geometry: IGeometry): IGeometry => {
    return adaptPolygons([poligonId], geometry, p => {
        const edgeDir = vector.subtract(edge.end.vector, edge.start.vector);
        const edgeLen = vector.norm(edgeDir);
        if (edgeLen === 0) return p.edges.map(e => cloneEdge(e));

        // Determine outward normal using winding
        const area = signedArea(p);
        const windingSign = area >= 0 ? -1 : 1;
        const nd = vector.normalize(edgeDir);
        const outwardNormal: vector.Vector = [-nd[1] * windingSign, nd[0] * windingSign];

        // Compute extrusion distance as projection of (target - edge midpoint) onto outward normal
        const edgeMid: vector.Vector = [(edge.start.vector[0] + edge.end.vector[0]) / 2,
                                         (edge.start.vector[1] + edge.end.vector[1]) / 2];
        const d = vector.dot(vector.subtract(target, edgeMid), outwardNormal);

        const offset = vector.scale(d, outwardNormal);
        const newStart = vector.add(edge.start.vector, offset);
        const newEnd = vector.add(edge.end.vector, offset);

        return p.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (e.id !== edge.id) return acc.concat(e);
            // Replace original edge with: side1 -> front -> side2
            const side1 = { ...makeEdge(e.start.vector, newStart), material: cloneMaterial(e.material), immaterial: e.immaterial } as IEdge;
            const front = { ...makeEdge(newStart, newEnd), material: cloneMaterial(e.material), immaterial: e.immaterial } as IEdge;
            const side2 = { ...makeEdge(newEnd, e.end.vector), material: cloneMaterial(e.material), immaterial: e.immaterial } as IEdge;
            return acc.concat(side1, front, side2);
        }, [] as IEdge[]);
    });
};

// ============================================================================
// 3. Bevel / Chamfer Vertex
// Replaces a vertex with a flat edge (chamfer) or multi-segment arc (bevel).
// `distance` is how far from the vertex the new edge starts/ends.
// `segments` = 1 for chamfer, >1 for bevel (arc approximation).
// ============================================================================
export const bevelVertex = (vertex: IVertex, poligonId: IEntityKey, dist: number, segments: number, geometry: IGeometry): IGeometry => {
    if (dist <= 0) return geometry;
    const segs = Math.max(1, segments);
    return adaptPolygons([poligonId], geometry, p => {
        // Find the two edges that share this vertex: incoming (ends at vertex) and outgoing (starts at vertex)
        const incomingIdx = p.edges.findIndex(e => areEqual(e.end, vertex));
        const outgoingIdx = p.edges.findIndex(e => areEqual(e.start, vertex));
        if (incomingIdx < 0 || outgoingIdx < 0) return p.edges.map(e => cloneEdge(e));

        const incoming = p.edges[incomingIdx];
        const outgoing = p.edges[outgoingIdx];

        // Compute points on the incoming and outgoing edges at `dist` from the vertex
        const inDir = vector.subtract(incoming.start.vector, vertex.vector);
        const inLen = vector.norm(inDir);
        const outDir = vector.subtract(outgoing.end.vector, vertex.vector);
        const outLen = vector.norm(outDir);

        const clampedDist = Math.min(dist, inLen * 0.999, outLen * 0.999);
        const pointOnIncoming = vector.add(vertex.vector, vector.scale(clampedDist / inLen, inDir));
        const pointOnOutgoing = vector.add(vertex.vector, vector.scale(clampedDist / outLen, outDir));

        // Generate the bevel/chamfer points
        const bevelPoints: vector.Vector[] = [pointOnIncoming];
        if (segs > 1) {
            for (let i = 1; i < segs; i++) {
                const t = i / segs;
                // Interpolate along the arc using spherical-like interpolation on the directions
                const blendedDir = vector.add(vector.scale(1 - t, inDir), vector.scale(t, outDir));
                const blendedLen = vector.norm(blendedDir);
                if (blendedLen > 0) {
                    bevelPoints.push(vector.add(vertex.vector, vector.scale(clampedDist / blendedLen, blendedDir)));
                }
            }
        }
        bevelPoints.push(pointOnOutgoing);

        return p.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (e.id === incoming.id) {
                // Truncate incoming edge to end at pointOnIncoming
                const truncated = { ...makeEdge(e.start.vector, pointOnIncoming), material: cloneMaterial(e.material), immaterial: e.immaterial } as IEdge;
                acc.push(truncated);
                // Add bevel edges
                for (let i = 0; i < bevelPoints.length - 1; i++) {
                    acc.push({ ...makeEdge(bevelPoints[i], bevelPoints[i + 1]), material: cloneMaterial(e.material), immaterial: e.immaterial } as IEdge);
                }
                return acc;
            } else if (e.id === outgoing.id) {
                // Truncate outgoing edge to start at pointOnOutgoing
                const truncated = { ...makeEdge(pointOnOutgoing, e.end.vector), material: cloneMaterial(e.material), immaterial: e.immaterial } as IEdge;
                return acc.concat(truncated);
            }
            return acc.concat(e);
        }, [] as IEdge[]);
    });
};

// ============================================================================
// 4. Inset Edge
// Splits an edge into three parts, pulling the middle part inward.
// `splitRatio` is 0..1 controlling how much of the edge is the inset portion.
// `depth` is how far the middle portion is pushed inward.
// ============================================================================
export const insetEdge = (edge: IEdge, poligonId: IEntityKey, depth: number, splitRatio: number, geometry: IGeometry): IGeometry => {
    const ratio = Math.max(0.01, Math.min(0.99, splitRatio));
    return adaptPolygons([poligonId], geometry, p => {
        const area = signedArea(p);
        const windingSign = area >= 0 ? -1 : 1;

        return p.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (e.id !== edge.id) return acc.concat(e);

            const s = e.start.vector;
            const d = e.end.vector;
            const edgeDir = vector.subtract(d, s);
            const edgeLen = vector.norm(edgeDir);
            if (edgeLen === 0) return acc.concat(e);

            const nd = vector.normalize(edgeDir);
            const outwardNormal: vector.Vector = [-nd[1] * windingSign, nd[0] * windingSign];
            const inwardOffset = vector.scale(-depth, outwardNormal);

            // Split points along the edge
            const margin = (1 - ratio) / 2;
            const p1 = vector.add(s, vector.scale(margin, edgeDir));
            const p2 = vector.add(s, vector.scale(1 - margin, edgeDir));

            // Inset points
            const p1i = vector.add(p1, inwardOffset);
            const p2i = vector.add(p2, inwardOffset);

            const mat = cloneMaterial(e.material);
            const imm = e.immaterial;
            const e1 = { ...makeEdge(s, p1), material: cloneMaterial(mat), immaterial: imm } as IEdge;
            const e2 = { ...makeEdge(p1, p1i), material: cloneMaterial(mat), immaterial: imm } as IEdge;
            const e3 = { ...makeEdge(p1i, p2i), material: cloneMaterial(mat), immaterial: imm } as IEdge;
            const e4 = { ...makeEdge(p2i, p2), material: cloneMaterial(mat), immaterial: imm } as IEdge;
            const e5 = { ...makeEdge(p2, d), material: cloneMaterial(mat), immaterial: imm } as IEdge;

            return acc.concat(e1, e2, e3, e4, e5);
        }, [] as IEdge[]);
    });
};

// ============================================================================
// 5. Flip / Mirror Polygon
// Reflects polygon(s) across an axis: 'horizontal' (flip across Y), 
// 'vertical' (flip across X), or along a custom axis line.
// ============================================================================
export const flipPolygon = (polygonIds: IEntityKey[], axis: 'horizontal' | 'vertical', geometry: IGeometry): IGeometry => {
    const polygons = geometry.polygons.filter(x => polygonIds.includes(x.id));
    const mergedBB = polygons.slice(1).reduce((acc, p) => merge(acc, p.boundingBox), polygons[0].boundingBox);
    const center = centerOf(mergedBB);

    return adaptPolygons(polygonIds, geometry, p => {
        const newVertices = p.vertices.map(v => {
            const relative = vector.subtract(v.vector, center);
            const flipped: vector.Vector = axis === 'horizontal'
                ? [-relative[0], relative[1]]
                : [relative[0], -relative[1]];
            return vector.add(center, flipped);
        });

        // Reverse winding to maintain consistent orientation after mirroring
        const reversedVertices = [newVertices[0], ...newVertices.slice(1).reverse()];
        const edges = createEdges(reversedVertices);
        return edges.map((e, i) => ({
            ...e,
            immaterial: p.edges[p.edges.length - 1 - i]?.immaterial ?? false,
            material: p.edges[p.edges.length - 1 - i] && cloneMaterial(p.edges[p.edges.length - 1 - i].material) || e.material,
        }));
    });
};

// ============================================================================
// 6. Scale Polygon (Non-Uniform)
// Scales polygon(s) from their center with independent X and Y factors.
// ============================================================================
export const scalePolygon = (polygonIds: IEntityKey[], scaleX: number, scaleY: number, geometry: IGeometry): IGeometry => {
    const polygons = geometry.polygons.filter(x => polygonIds.includes(x.id));
    const mergedBB = polygons.slice(1).reduce((acc, p) => merge(acc, p.boundingBox), polygons[0].boundingBox);
    const center = centerOf(mergedBB);

    return adaptPolygons(polygonIds, geometry, p => {
        const newVertices = p.vertices.map(v => {
            const relative = vector.subtract(v.vector, center);
            const scaled: vector.Vector = [relative[0] * scaleX, relative[1] * scaleY];
            return vector.add(center, scaled);
        });

        const edges = createEdges(newVertices);
        return edges.map((e, i) => ({
            ...e,
            immaterial: p.edges[i]?.immaterial ?? false,
            material: p.edges[i] && cloneMaterial(p.edges[i].material) || e.material,
        }));
    });
};

// ============================================================================
// 7. Regularize Polygon
// Transforms a polygon into a regular polygon (equal edge lengths, equal angles)
// while keeping the same center and approximate size (average radius).
// ============================================================================
export const regularizePolygon = (polygonId: IEntityKey, geometry: IGeometry): IGeometry => {
    return adaptPolygons([polygonId], geometry, p => {
        const n = p.vertices.length;
        if (n < 3) return p.edges.map(e => cloneEdge(e));

        const center = centerOf(p.boundingBox);

        // Compute average radius
        const avgRadius = p.vertices.reduce((sum, v) => sum + vector.distance(v.vector, center), 0) / n;

        // Determine starting angle from center to first vertex
        const startAngle = Math.atan2(
            p.vertices[0].vector[1] - center[1],
            p.vertices[0].vector[0] - center[0]
        );

        // Detect winding direction
        const area = signedArea(p);
        const direction = area >= 0 ? 1 : -1; // CCW = positive angle increments

        const newVertices: vector.Vector[] = [];
        for (let i = 0; i < n; i++) {
            const angle = startAngle + direction * (2 * Math.PI * i / n);
            newVertices.push([
                center[0] + avgRadius * Math.cos(angle),
                center[1] + avgRadius * Math.sin(angle),
            ]);
        }

        const edges = createEdges(newVertices);
        return edges.map((e, i) => ({
            ...e,
            immaterial: p.edges[i]?.immaterial ?? false,
            material: p.edges[i] && cloneMaterial(p.edges[i].material) || e.material,
        }));
    });
};

// ============================================================================
// 8. Convex Hull
// Replaces a polygon with its convex hull using Graham scan.
// ============================================================================
export const convexHull = (polygonId: IEntityKey, geometry: IGeometry): IGeometry => {
    return adaptPolygons([polygonId], geometry, p => {
        const points = p.vertices.map(v => v.vector.slice() as vector.Vector);
        if (points.length < 3) return p.edges.map(e => cloneEdge(e));

        // Find the bottom-most point (lowest y, then leftmost x)
        let pivotIdx = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i][1] > points[pivotIdx][1] ||
                (points[i][1] === points[pivotIdx][1] && points[i][0] < points[pivotIdx][0])) {
                pivotIdx = i;
            }
        }
        const pivot = points[pivotIdx];

        // Sort by polar angle relative to pivot
        const sorted = points
            .filter((_, i) => i !== pivotIdx)
            .sort((a, b) => {
                const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
                const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
                if (Math.abs(angleA - angleB) < 1e-10) {
                    return vector.distance(pivot, a) - vector.distance(pivot, b);
                }
                return angleA - angleB;
            });

        // Graham scan
        const hull: vector.Vector[] = [pivot];
        for (const point of sorted) {
            while (hull.length >= 2) {
                const a = hull[hull.length - 2];
                const b = hull[hull.length - 1];
                const crossVal = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
                if (crossVal <= 0) {
                    hull.pop();
                } else {
                    break;
                }
            }
            hull.push(point);
        }

        if (hull.length < 3) return p.edges.map(e => cloneEdge(e));

        // Preserve winding direction of original polygon
        const origArea = signedArea(p);
        const hullPoly = createPolygon(hull);
        const hullArea = signedArea(hullPoly);
        const hullVertices = (origArea * hullArea < 0)
            ? [hull[0], ...hull.slice(1).reverse()]
            : hull;

        const edges = createEdges(hullVertices);
        return edges.map(e => ({
            ...e,
            immaterial: false,
            material: p.edges[0] && cloneMaterial(p.edges[0].material) || e.material,
        }));
    });
};

// ============================================================================
// 9. Inset / Outset Polygon (Frame)
// Creates a smaller copy of the polygon inside it. Returns the geometry with
// the new inner polygon added. The outer polygon is unchanged.
// ============================================================================
export const insetPolygon = (polygonId: IEntityKey, dist: number, geometry: IGeometry): [IPolygon, IGeometry] => {
    const polygon = geometry.polygons.find(p => p.id === polygonId);
    if (!polygon || polygon.edges.length < 3) return [null, geometry];

    const n = polygon.edges.length;
    const area = signedArea(polygon);
    const windingSign = area >= 0 ? -1 : 1;

    // Compute inward-offset normals for each edge (inward = negate the outward normal)
    const normals: vector.Vector[] = polygon.edges.map(e => {
        const dir = vector.subtract(e.end.vector, e.start.vector);
        const len = vector.norm(dir);
        if (len === 0) return [0, 0] as vector.Vector;
        const nd = vector.normalize(dir);
        // Inward normal: opposite of outward
        return [nd[1] * windingSign, -nd[0] * windingSign] as vector.Vector;
    });

    // Offset each edge inward by dist
    const offsetEdges: [vector.Vector, vector.Vector][] = polygon.edges.map((e, i) => {
        const offset = vector.scale(dist, normals[i]);
        return [vector.add(e.start.vector, offset), vector.add(e.end.vector, offset)];
    });

    // Intersect adjacent offset edge lines for new vertices
    const newVertices: vector.Vector[] = [];
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const dirA = vector.subtract(offsetEdges[i][1], offsetEdges[i][0]);
        const dirB = vector.subtract(offsetEdges[j][1], offsetEdges[j][0]);
        const crossVal = vector.cross(dirA, dirB);
        if (Math.abs(crossVal) < 1e-10) {
            newVertices.push(offsetEdges[i][1]);
        } else {
            newVertices.push(lineIntersect(offsetEdges[i], offsetEdges[j]));
        }
    }

    const innerPolygon = createPolygon(newVertices);
    // Copy materials from outer polygon to inner
    innerPolygon.edges.forEach((e, i) => {
        if (polygon.edges[i]) {
            e.material = cloneMaterial(polygon.edges[i].material);
            e.immaterial = polygon.edges[i].immaterial;
        }
    });
    // Propagate floor/ceiling materials
    innerPolygon.floorMaterial = cloneSimpleMaterial(polygon.floorMaterial);
    innerPolygon.ceilingMaterial = cloneSimpleMaterial(polygon.ceilingMaterial);

    const newGeometry = {
        ...geometry,
        polygons: [...geometry.polygons, innerPolygon],
        edgeCount: countEdges([...geometry.polygons, innerPolygon]),
        bounds: findBounds([...geometry.polygons, innerPolygon]),
    };

    return [innerPolygon, newGeometry];
};

// ============================================================================
// 10. Merge Polygons
// Combines two or more adjacent polygons that share edges into a single polygon,
// removing the shared interior edges.
// ============================================================================
export const mergePolygons = (polygonIds: IEntityKey[], geometry: IGeometry): IGeometry => {
    const toMerge = geometry.polygons.filter(p => polygonIds.includes(p.id));
    if (toMerge.length < 2) return geometry;

    // Collect all edges from all polygons to merge
    const allEdges: { edge: IEdge, polygonId: IEntityKey }[] = [];
    toMerge.forEach(p => p.edges.forEach(e => allEdges.push({ edge: e, polygonId: p.id })));

    // Find shared edges: edges where one polygon has A->B and another has B->A (or close to it)
    const sharedEdgeIds = new Set<string>();
    for (let i = 0; i < allEdges.length; i++) {
        for (let j = i + 1; j < allEdges.length; j++) {
            if (allEdges[i].polygonId === allEdges[j].polygonId) continue;
            const ei = allEdges[i].edge;
            const ej = allEdges[j].edge;
            // Check if edges share the same vertices in opposite directions
            if ((areClose(ei.start, ej.end) && areClose(ei.end, ej.start)) ||
                (areClose(ei.start, ej.start) && areClose(ei.end, ej.end))) {
                sharedEdgeIds.add(ei.id);
                sharedEdgeIds.add(ej.id);
            }
        }
    }

    if (sharedEdgeIds.size === 0) return geometry; // No shared edges, nothing to merge

    // Collect non-shared edges
    const boundaryEdges = allEdges
        .filter(({ edge }) => !sharedEdgeIds.has(edge.id))
        .map(({ edge }) => edge);

    if (boundaryEdges.length < 3) return geometry;

    // Trace the boundary: build an adjacency from end vertex to next edge's start,
    // preserving the original edge objects (and their materials/properties)
    const traceBoundary = (edges: IEdge[]): IEdge[] => {
        const edgeMap = new Map<string, IEdge>();
        edges.forEach(e => {
            const key = `${Math.round(e.start.vector[0] * 100)},${Math.round(e.start.vector[1] * 100)}`;
            edgeMap.set(key, e);
        });

        const result: IEdge[] = [];
        let current = edges[0];
        const visited = new Set<string>();

        for (let i = 0; i < edges.length; i++) {
            result.push(current);
            const endKey = `${Math.round(current.end.vector[0] * 100)},${Math.round(current.end.vector[1] * 100)}`;
            if (visited.has(current.id)) break;
            visited.add(current.id);
            const next = edgeMap.get(endKey);
            if (!next) break;
            current = next;
        }

        return result;
    };

    const tracedEdges = traceBoundary(boundaryEdges);
    if (tracedEdges.length < 3) return geometry;

    // Clone the traced edges to avoid mutating the original polygons,
    // preserving each edge's material, immaterial flag, and other properties
    const clonedEdges = tracedEdges.map(e => cloneEdge(e));
    const mergedPolygon = loadPolygon({ edges: clonedEdges });

    // Remove merged polygons, add the new one
    const remaining = geometry.polygons.filter(p => !polygonIds.includes(p.id));
    const polygons = [...remaining, mergedPolygon];
    return { ...geometry, polygons, edgeCount: countEdges(polygons), bounds: findBounds(polygons) };
};

// ============================================================================
// 11. Align Vertices
// Snaps selected vertices to a common line (horizontal or vertical).
// 'horizontal' aligns Y to average Y, 'vertical' aligns X to average X.
// ============================================================================
export const alignVertices = (axis: 'horizontal' | 'vertical', map: IVertexMap, geometry: IGeometry): IGeometry => {
    // Compute average coordinate
    let sum = 0, count = 0;
    map.forEach(vertices => {
        vertices.forEach(v => {
            sum += axis === 'horizontal' ? v.vector[1] : v.vector[0];
            count++;
        });
    });
    if (count === 0) return geometry;
    const avg = sum / count;

    return adaptPolygons(Array.from(map.keys()), geometry, p => {
        const vertices = map.get(p.id) || [];
        return p.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            const moveIfSelected = (v: IVertex) => {
                if (vertices.some(sv => sv.id === v.id)) {
                    if (axis === 'horizontal') {
                        v.vector[1] = avg;
                    } else {
                        v.vector[0] = avg;
                    }
                }
            };
            moveIfSelected(e.start);
            moveIfSelected(e.end);
            return acc.concat(e);
        }, [] as IEdge[]);
    });
};

// ============================================================================
// 12. Align Polygons
// Aligns multiple polygons to a common edge of their combined bounding box.
// direction: 'top' | 'bottom' | 'left' | 'right' | 'center-h' | 'center-v'
// ============================================================================
export const alignPolygons = (polygonIds: IEntityKey[], direction: 'top' | 'bottom' | 'left' | 'right' | 'center-h' | 'center-v', geometry: IGeometry): IGeometry => {
    const polygons = geometry.polygons.filter(x => polygonIds.includes(x.id));
    if (polygons.length < 2) return geometry;

    const mergedBB = polygons.slice(1).reduce((acc, p) => merge(acc, p.boundingBox), polygons[0].boundingBox);

    return adaptPolygons(polygonIds, geometry, p => {
        const bb = p.boundingBox;
        let delta: vector.Vector = [0, 0];

        switch (direction) {
            case 'top':
                delta = [0, mergedBB[0][1] - bb[0][1]];
                break;
            case 'bottom':
                delta = [0, mergedBB[1][1] - bb[1][1]];
                break;
            case 'left':
                delta = [mergedBB[0][0] - bb[0][0], 0];
                break;
            case 'right':
                delta = [mergedBB[1][0] - bb[1][0], 0];
                break;
            case 'center-h': {
                const mergedCenter = (mergedBB[0][0] + mergedBB[1][0]) / 2;
                const polyCenter = (bb[0][0] + bb[1][0]) / 2;
                delta = [mergedCenter - polyCenter, 0];
                break;
            }
            case 'center-v': {
                const mergedCenter = (mergedBB[0][1] + mergedBB[1][1]) / 2;
                const polyCenter = (bb[0][1] + bb[1][1]) / 2;
                delta = [0, mergedCenter - polyCenter];
                break;
            }
        }

        const edges = createEdges(p.vertices.map(v => vector.add(v.vector, delta)));
        return edges.map((e, i) => ({
            ...e,
            immaterial: p.edges[i]?.immaterial ?? false,
            material: p.edges[i] && cloneMaterial(p.edges[i].material) || e.material,
        }));
    });
};

// ============================================================================
// 13. Weld / Merge Vertices
// Merges two or more close vertices into a single vertex (their centroid),
// within a polygon or across polygons.
// ============================================================================
export const weldVertices = (map: IVertexMap, geometry: IGeometry): IGeometry => {
    // Compute the centroid of all selected vertices
    let sumX = 0, sumY = 0, count = 0;
    map.forEach(vertices => {
        vertices.forEach(v => {
            sumX += v.vector[0];
            sumY += v.vector[1];
            count++;
        });
    });
    if (count < 2) return geometry;
    const centroid: vector.Vector = [sumX / count, sumY / count];

    const result = adaptPolygons(Array.from(map.keys()), geometry, p => {
        const vertices = map.get(p.id) || [];
        const vertexIds = new Set(vertices.map(v => v.id));
        return p.edges.map(e => cloneEdge(e)).reduce((acc, e) => {
            if (vertexIds.has(e.start.id)) {
                vector.copyIn(e.start.vector, centroid);
            }
            if (vertexIds.has(e.end.id)) {
                vector.copyIn(e.end.vector, centroid);
            }
            // Skip zero-length edges (both endpoints welded to same point)
            if (vertexIds.has(e.start.id) && vertexIds.has(e.end.id)) {
                return acc;
            }
            return acc.concat(e);
        }, [] as IEdge[]);
    });
    return {...result, polygons: result.polygons.filter(_ => _.edgeCount > 0)};
};

// ============================================================================
// 14. Create Regular Polygon
// Creates a regular N-gon at a specified center with a given radius.
// ============================================================================
export const createRegularPolygon = (center: vector.Vector, radius: number, sides: number, geometry: IGeometry): IGeometry => {
    if (sides < 3 || radius <= 0) return geometry;

    const vertices: vector.Vector[] = [];
    for (let i = 0; i < sides; i++) {
        const angle = (2 * Math.PI * i / sides) - Math.PI / 2; // Start from top
        vertices.push([
            center[0] + radius * Math.cos(angle),
            center[1] + radius * Math.sin(angle),
        ]);
    }

    const polygon = createPolygon(vertices);
    return addPolygon(polygon, geometry);
};