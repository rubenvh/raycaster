import { ILineSegment } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { giveIdentity, IEntity } from "./entity";
import { cloneMaterial, IMaterial } from "./properties";
import { cloneVertex, IVertex, makeVertex } from "./vertex";

export type IEdge = IEntity & { start: IVertex, end: IVertex, material?: IMaterial, immaterial?: boolean};

export const makeEdge = (v: Vector, u: Vector): IEdge => ({start: makeVertex(v), end: makeVertex(u)});
export const segmentFrom = (e: IEdge): ILineSegment => [e.start.vector, e.end.vector];
export const cloneEdge = (e: IEdge, delta: Vector): IEdge => giveIdentity<IEdge>({
    start: cloneVertex(e.start, delta),
    end: cloneVertex(e.end, delta),
    immaterial: e.immaterial,
    material: cloneMaterial(e.material),
});