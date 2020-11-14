import { IGeometry } from './vertex';
import { createGeometry, Geometry } from './geometry';
import { Vector } from './vector';
describe('geometry tests', () => {
    describe('creating geometry from vectors', () => {
        const invokeSut = (vectors: Vector[][]) => createGeometry(vectors);

        describe('creating a single polygon', () => {
            it('then results in single polygon', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0]]]);
                expect(actual.polygons.length).toBe(1);                
            });
            it('then polygon is closed automatically', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0]]]);
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });
            it('then last vertex merged into first vertex if identical', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0], [0, 0]]]).polygons[0];
                expect(actual.vertices.length).toBe(3);
                expect(actual.edges.length).toBe(3);
                expect(actual.edges[actual.edges.length-1].end).toBe(actual.edges[0].start);

            });
            it('then last vertex merged into first vertex if same', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0], [0.001, 0.001]]]);
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });      
            it('then can all vertices in polygon have 2 edges (incoming and outgoing)', () => {
                let actual = invokeSut([[[0,0], [0,1], [1,0], [0, 0]]]).polygons[0];
                expect(actual.vertices[0].edges.length).toBe(2);
                expect(actual.vertices[1].edges.length).toBe(2);
                expect(actual.vertices[2].edges.length).toBe(2);
            });       
        });
    });
    describe('loading geometry from objects', () => {
        const invokeSut = (geometryData: IGeometry) => new Geometry(geometryData);

        describe('creating a single polygon', () => {
            it('then results in single polygon', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]});

                expect(actual.polygons.length).toBe(1);
            });           
            it('then last vertex merged into first vertex if identical', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]}).polygons[0];   
                expect(actual.vertices.length).toBe(3);
                expect(actual.edges.length).toBe(3);
                expect(actual.edges[actual.edges.length-1].end === actual.edges[0].start).toBeTruthy();
            });

            it('then can all vertices in polygon have 2 edges (incoming and outgoing)', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]}).polygons[0];
                expect(actual.vertices[0].edges.length).toBe(2);
                expect(actual.vertices[1].edges.length).toBe(2);
                expect(actual.vertices[2].edges.length).toBe(2);
            });      
            it('then last vertex merged into first vertex if same', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0.001, 0.001]}},
                ]}]});  
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });   
        });
    });
  });
  