import { Guid } from "guid-typescript";

export type Color = [number, number, number, number];
export type IMaterial = {color: Color, texture?: Guid, luminosity?: number};