import { ILineSegment } from "../math/lineSegment";
import { Vector } from "../math/vector";
import { IEntity } from "./entity";
import { IMaterial } from "./properties";
import { IVertex, makeVertex } from "./vertex";

export type IEdge = IEntity & { start: IVertex, end: IVertex, material?: IMaterial, immaterial?: boolean};

export const makeEdge = (v: Vector, u: Vector): IEdge => ({start: makeVertex(v), end: makeVertex(u)});
export const segmentFrom = (e: IEdge): ILineSegment => [e.start.vector, e.end.vector];