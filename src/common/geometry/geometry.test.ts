import { createGeometry, splitPolygon, IStoredGeometry, loadGeometry, removeVertex, IGeometry } from './geometry';
import { Vector } from '../math/vector';

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
        });
    });
    describe('loading geometry from objects', () => {
        const invokeSut = (geometryData: IStoredGeometry) => loadGeometry(geometryData);

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
            it('then last vertex merged into first vertex if same', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0.001, 0.001]}},
                ]}]});  
                expect(actual.polygons[0].vertices.length).toBe(3);
                expect(actual.polygons[0].edges.length).toBe(3);
            });   
            it('then start of next is same as end of previous', () => {
                let actual = invokeSut({polygons: [{edges: [
                    {start: {vector: [0, 0]}, end: {vector: [0, 1]}},
                    {start: {vector: [0, 1]}, end: {vector: [1, 0]}},
                    {start: {vector: [1, 0]}, end: {vector: [0, 0]}},
                ]}]});  

                let p = actual.polygons[0];
                p.edges.reduce((acc, p) => {
                    expect(p.start).toBe(acc.end);
                    return p;
                });                
            }); 
        });
    });
    describe('removing geometry', () => {
        // create 2 polygons
        const geometry: IGeometry = createGeometry([
            [[0, 0],[0,1], [1,1],[1,0]],
            [[5, 5],[5,6], [6,6],[6,5]]
        ]);

        describe('removing entire polygon', () => {
            it('then polygon is not present anymore', () => {
                const polygon = geometry.polygons[0];
                const actual = polygon.vertices.reduce((acc, cur) => removeVertex(cur, polygon.id, acc), geometry);                
                expect(actual.polygons.find(_ => _.id === polygon.id)).toBeUndefined();                
            });                      
        });
        describe('removing vertex', () => {
            it('then polygon still exists without deleted vertex', () => {
                const polygon = geometry.polygons[0];
                const vertexToDelete = polygon.vertices[0];
                const actual = removeVertex(vertexToDelete, polygon.id, geometry);                
                expect(actual.polygons.some(_ => _.id === polygon.id)).toBeTruthy();
                const changedPoly = actual.polygons.find(_=>_.id === polygon.id);
                expect(changedPoly.vertices.length).toBe(3);
                expect(changedPoly.vertices.find(_=>_.id === vertexToDelete.id)).toBeUndefined();
                
            });                      
        });
    });

    describe('splitting polygon', () => {
        // create 1 polygons
        const geometry: IGeometry = createGeometry([[[0, 0],[0,1], [1,1],[1,0]]]);

        describe('split polygon using 2 opposing vertices', () => {
            it('then 2 polygons present with different ids', () => {
                const polygon = geometry.polygons[0];
                polygon.vertices[0]
                const actual = splitPolygon(polygon.vertices[0], polygon.vertices[1], polygon.id, geometry);
                expect(actual.polygons.length).toBe(2);
                expect(actual.polygons[0].id).not.toBe(actual.polygons[1].id);
            });                      
        });       
    });
    describe('perf test', () => {
        // it('running intersections for all rays', () => {
        //     const world = {
        //         camera: makeCamera({position: [50,50], direction: [0,-10], plane: [-15, 0]}),
        //         geometry: createGeometry([
        //              [[30,20],[60,20],[60,80],[100,80],[100,60],[120,60],[125,75],[140,80],[140,60],[160,60],[160,80],[180,80],[180,40],[160,40],[160,0],[260,0],[260,40],[200,40],[200,140],[240,140],[240,380],[120,380],[120,140],[180,140],[180,100],[20,100]]
        //         ]),
        //     };
        //     const start = process.hrtime();
        //     for (let i = 0; i < 600; i++) {
        //         const rays = makeRays(1280, world.camera);

        //         for (let ray of rays){
        //             var hits = detectCollisions(ray, world.geometry).hits.sort((a,b)=> a.distance - b.distance);
        //         }
        //     }      
        //     const end = process.hrtime(start);
        //     console.log(end);
        // })
    });
});
  