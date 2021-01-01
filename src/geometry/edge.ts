import { ILineSegment, slope } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { giveIdentity, IEntity } from "./entity";
import { cloneMaterial, Color, IMaterial } from "./properties";
import { areClose, cloneVertex, distance, duplicateVertex, IVertex, makeVertex } from "./vertex";

type EdgeBase = IEntity & { start: IVertex, end: IVertex, material?: IMaterial, immaterial?: boolean};
export type IEdge = EdgeBase & { length: number, slope: number, luminosity: number};
export type IStoredEdge = EdgeBase;
export const storeEdge = (e: IEdge): IStoredEdge => ({
    id: e.id,
    start: e.start,
    end: e.end,
    immaterial: e.immaterial,
    material: e.material,    
})

export const loadEdge = (e: IStoredEdge): IEdge => {
    const line: ILineSegment = [e.start.vector, e.end.vector];
    const m: number = slope(line);
    return ({
        id: e.id,
        start: e.start,
        end: e.end,
        material: e.material,
        immaterial: e.immaterial, 
        length: distance(e.start, e.end),
        slope: m,
        luminosity: determineLuminosity(m)});
};

export const makeEdge = (v: Vector, u: Vector): IEdge => loadEdge({
    start: makeVertex(v), 
    end: makeVertex(u),    
    });
export const segmentFrom = (e: IEdge): ILineSegment => [e.start.vector, e.end.vector];

export const duplicateEdge = (e: IEdge, delta: Vector): IEdge => giveIdentity<IEdge>({
        start: duplicateVertex(e.start, delta),
        end: duplicateVertex(e.end, delta),
        immaterial: e.immaterial,
        material: cloneMaterial(e.material),
        length: e.length,
        slope: e.slope,
        luminosity: e.luminosity,
});

export const cloneEdge = (e: IEdge): IEdge => loadEdge({
    id: e.id,
    start: cloneVertex(e.start),
    end: cloneVertex(e.end),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),
});

export const createEdges = (vectors: Vector[]): IEdge[] =>  {
    // transform all vectors into vertices
    const vertices = vectors.map(makeVertex).map(giveIdentity);
    const startingVertex = vertices[0];
    
    // we are closing the polygon at the end, so remove the last vertex if it's close to the starting vertex
    if (areClose(startingVertex, vertices[vertices.length-1])) vertices.pop();       
    
    // put start at the end and reduce over the vertices to create a collection of edges
    return vertices.slice(1).concat([startingVertex])
        .reduce((acc, v) => {            
            return ({ 
                                edges: [...acc.edges, loadEdge({
                                    start: acc.previous, 
                                    end: v,
                                    material: {color: [20, 20, 255, 1] as Color},
                                    immaterial: false
                                })],
                                previous: v,
                            });}, 
            {previous: startingVertex, edges: [] as IEdge[]})
        .edges;    
}

export const determineLuminosity = (slope: number) => {        
    let percentage = 0.4;
    let m = Math.abs(slope || 0);
    if (!isFinite(m)) return 1;        
    return percentage + (m / (1 + m)) * (1 - percentage);
};
