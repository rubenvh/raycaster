import { createGeometry, loadGeometry, IStoredGeometry } from '../geometry';
import { buildBspTree } from './creation';
import { intersectRay } from './querying';
import { intersectRayPolygons, makeRay, RayHit } from '../collision';
import { Vector, normalize, subtract } from '../../math/vector';
import { IBSPNode, isLeafNode, isSplitNode } from './model';
import { IPolygon } from '../polygon';
import { isTranslucent, Face } from '../properties';
import * as fs from 'fs';
import * as path from 'path';

describe('BSP intersection tests', () => {
    describe('angled-passage polygon ray intersection bug', () => {
        // Simplified version of the angled-passage polygon from maze.json
        // ap-e6 is the vertical edge at x=120 from [120,440] to [120,400]
        const angledPassageGeometry = createGeometry([
            [[120, 400], [200, 380], [280, 420], [320, 460], [200, 460], [120, 440]] // angled-passage
        ]);

        it('should find the edge at x=120 using direct polygon intersection', () => {
            // Camera at [74.16, 374.11], target middle of ap-e6 at [120, 420]
            const rayPos: Vector = [74.16, 374.11];
            const target: Vector = [120, 420];
            const rayDir = subtract(target, rayPos);
            const ray = makeRay(rayPos, rayDir);

            const result = intersectRayPolygons(angledPassageGeometry.polygons, ray, {});
            
            console.log('Direct polygon intersection hits:', result.hits.length);
            result.hits.forEach(h => {
                console.log('  Edge:', h.edge.start.vector, '->', h.edge.end.vector, 'at distance', h.distance);
            });

            // The ray should hit the vertical edge at x=120
            expect(result.hits.some(h => 
                h.edge.start.vector[0] === 120 && h.edge.end.vector[0] === 120
            )).toBe(true);
        });

        it('should find the edge at x=120 using BSP intersection', () => {
            const bsp = buildBspTree(angledPassageGeometry.polygons);
            
            // Camera at [74.16, 374.11], target middle of ap-e6 at [120, 420]
            const rayPos: Vector = [74.16, 374.11];
            const target: Vector = [120, 420];
            const rayDir = subtract(target, rayPos);
            const ray = makeRay(rayPos, rayDir);

            const result = intersectRay(bsp, ray, {});
            
            console.log('BSP intersection hits:', result.hits.length);
            result.hits.forEach(h => {
                console.log('  Edge:', h.edge.start.vector, '->', h.edge.end.vector, 'at distance', h.distance);
            });

            // The ray should hit the vertical edge at x=120
            expect(result.hits.some(h => 
                h.edge.start.vector[0] === 120 && h.edge.end.vector[0] === 120
            )).toBe(true);
        });

        it('should preserve the vertical edge at x=120 during BSP construction', () => {
            const bsp = buildBspTree(angledPassageGeometry.polygons);
            
            // Recursively find all edges in the BSP tree
            const allEdges: {start: Vector, end: Vector, immaterial: boolean}[] = [];
            const collectEdges = (node: IBSPNode) => {
                if (isLeafNode(node)) {
                    node.polygons.forEach(p => {
                        p.edges.forEach(e => {
                            allEdges.push({
                                start: e.start.vector,
                                end: e.end.vector,
                                immaterial: e.immaterial ?? false
                            });
                        });
                    });
                } else if (isSplitNode(node)) {
                    node.coplanar.forEach(p => {
                        p.edges.forEach(e => {
                            allEdges.push({
                                start: e.start.vector,
                                end: e.end.vector,
                                immaterial: e.immaterial ?? false
                            });
                        });
                    });
                    collectEdges(node.front);
                    collectEdges(node.back);
                }
            };
            collectEdges(bsp);

            console.log('All edges in BSP:');
            allEdges.forEach(e => {
                console.log(' ', e.start, '->', e.end, e.immaterial ? '(immaterial)' : '');
            });

            // Check if the vertical edge at x=120 exists (possibly split)
            const verticalEdgesAtX120 = allEdges.filter(e => 
                e.start[0] === 120 && e.end[0] === 120 && !e.immaterial
            );
            
            console.log('Vertical edges at x=120:', verticalEdgesAtX120.length);
            verticalEdgesAtX120.forEach(e => {
                console.log('  ', e.start, '->', e.end);
            });

            expect(verticalEdgesAtX120.length).toBeGreaterThan(0);
        });
    });

    describe('multi-polygon BSP bug reproduction', () => {
        // Reproduce the bug with multiple polygons from maze.json
        // Key polygons that might cause splitting issues
        const multiPolygonGeometry = createGeometry([
            // outer wall (simplified)
            [[20, 20], [600, 20], [600, 500], [20, 500]],
            // angled-passage (the problem polygon)
            [[120, 400], [200, 380], [280, 420], [320, 460], [200, 460], [120, 440]],
            // Some nearby polygon to trigger splitting
            [[80, 350], [150, 350], [150, 390], [80, 390]],
        ]);

        it('should find ap-e6 with BSP when multiple polygons present', () => {
            const bsp = buildBspTree(multiPolygonGeometry.polygons);
            
            // Camera at [74.16, 374.11], target middle of ap-e6 at [120, 420]
            const rayPos: Vector = [74.16, 374.11];
            const target: Vector = [120, 420];
            const rayDir = subtract(target, rayPos);
            const ray = makeRay(rayPos, rayDir);

            // First check direct polygon intersection
            const directResult = intersectRayPolygons(multiPolygonGeometry.polygons, ray, {});
            console.log('Direct intersection hits:', directResult.hits.length);
            directResult.hits.forEach(h => {
                console.log('  Direct:', h.edge.start.vector, '->', h.edge.end.vector, 'dist:', h.distance);
            });

            // Now check BSP intersection
            const bspResult = intersectRay(bsp, ray, {});
            console.log('BSP intersection hits:', bspResult.hits.length);
            bspResult.hits.forEach(h => {
                console.log('  BSP:', h.edge.start.vector, '->', h.edge.end.vector, 'dist:', h.distance);
            });

            // The BSP should find the same edges as direct intersection
            const directEdgeAtX120 = directResult.hits.filter(h => 
                h.edge.start.vector[0] === 120 && h.edge.end.vector[0] === 120
            );
            const bspEdgeAtX120 = bspResult.hits.filter(h => 
                h.edge.start.vector[0] === 120 && h.edge.end.vector[0] === 120
            );

            console.log('Direct found edges at x=120:', directEdgeAtX120.length);
            console.log('BSP found edges at x=120:', bspEdgeAtX120.length);

            // Both should find the edge
            expect(bspEdgeAtX120.length).toBe(directEdgeAtX120.length);
        });

        it('should check if splitting preserved the edge', () => {
            const bsp = buildBspTree(multiPolygonGeometry.polygons);
            
            // Collect all edges from BSP
            const allEdges: {start: Vector, end: Vector, immaterial: boolean, polygonId: string}[] = [];
            const collectEdges = (node: IBSPNode, depth: number = 0) => {
                if (isLeafNode(node)) {
                    node.polygons.forEach(p => {
                        p.edges.forEach(e => {
                            allEdges.push({
                                start: e.start.vector,
                                end: e.end.vector,
                                immaterial: e.immaterial ?? false,
                                polygonId: p.id ?? 'unknown'
                            });
                        });
                    });
                } else if (isSplitNode(node)) {
                    node.coplanar.forEach(p => {
                        p.edges.forEach(e => {
                            allEdges.push({
                                start: e.start.vector,
                                end: e.end.vector,
                                immaterial: e.immaterial ?? false,
                                polygonId: p.id ?? 'unknown'
                            });
                        });
                    });
                    collectEdges(node.front, depth + 1);
                    collectEdges(node.back, depth + 1);
                }
            };
            collectEdges(bsp);

            // Find all edges at x=120 or near it
            const edgesNearX120 = allEdges.filter(e => 
                (Math.abs(e.start[0] - 120) < 1 || Math.abs(e.end[0] - 120) < 1) && !e.immaterial
            );
            
            console.log('Edges near x=120 in BSP:');
            edgesNearX120.forEach(e => {
                console.log('  ', e.start, '->', e.end, 'polygon:', e.polygonId);
            });

            // There should be at least one visible edge at x=120
            expect(edgesNearX120.length).toBeGreaterThan(0);
        });
    });

    describe('ray parallel to splitting plane bug', () => {
        it('should find edges in both subtrees when ray is parallel to splitting plane', () => {
            // Create a geometry where the ray will be parallel to a splitting plane
            // Two polygons separated by a vertical line at x=100
            const geometry = createGeometry([
                [[50, 50], [90, 50], [90, 150], [50, 150]], // left polygon
                [[110, 50], [150, 50], [150, 150], [110, 150]], // right polygon
            ]);
            
            const bsp = buildBspTree(geometry.polygons);
            
            // Ray starting at x=100 (potentially on a splitting plane), going horizontally
            // This ray should be able to hit edges in BOTH polygons
            const rayPos: Vector = [100, 100];
            const rayDirLeft: Vector = [-50, 0]; // pointing left
            const rayDirRight: Vector = [50, 0]; // pointing right
            
            const rayLeft = makeRay(rayPos, rayDirLeft);
            const rayRight = makeRay(rayPos, rayDirRight);
            
            // Direct intersection should find edges
            const directLeft = intersectRayPolygons(geometry.polygons, rayLeft, {});
            const directRight = intersectRayPolygons(geometry.polygons, rayRight, {});
            
            console.log('Direct left hits:', directLeft.hits.length);
            console.log('Direct right hits:', directRight.hits.length);
            
            // BSP intersection
            const bspLeft = intersectRay(bsp, rayLeft, {});
            const bspRight = intersectRay(bsp, rayRight, {});
            
            console.log('BSP left hits:', bspLeft.hits.length);
            console.log('BSP right hits:', bspRight.hits.length);
            
            // BSP should find the same number of hits as direct
            expect(bspLeft.hits.length).toBe(directLeft.hits.length);
            expect(bspRight.hits.length).toBe(directRight.hits.length);
        });
        
        it('should handle ray origin exactly on splitting plane', () => {
            // Create geometry that will likely have a splitting plane at x=100
            const geometry = createGeometry([
                [[50, 50], [100, 50], [100, 150], [50, 150]], // left polygon, edge at x=100
                [[100, 50], [150, 50], [150, 150], [100, 150]], // right polygon, edge at x=100
            ]);
            
            const bsp = buildBspTree(geometry.polygons);
            
            // Ray at x=100, going to the right - should hit right polygon's right edge
            const rayPos: Vector = [100, 100];
            const rayDir: Vector = [50, 0];
            const ray = makeRay(rayPos, rayDir);
            
            const direct = intersectRayPolygons(geometry.polygons, ray, {});
            const bspResult = intersectRay(bsp, ray, {});
            
            console.log('Ray at x=100, direct hits:', direct.hits.length);
            direct.hits.forEach(h => console.log('  Direct:', h.edge.start.vector, '->', h.edge.end.vector));
            
            console.log('Ray at x=100, BSP hits:', bspResult.hits.length);
            bspResult.hits.forEach(h => console.log('  BSP:', h.edge.start.vector, '->', h.edge.end.vector));
            
            expect(bspResult.hits.length).toBe(direct.hits.length);
        });
    });

    describe('actual maze.json bug reproduction', () => {
        it('should consistently find ap-e6 with actual camera rays', () => {
            // Load actual maze.json
            const mapPath = path.join(__dirname, '../../../../assets/maps/maze.json');
            const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            const geometry = loadGeometry(mapData.geometry as IStoredGeometry);
            
            // Camera from maze.json (exact values)
            const camera = mapData.camera;
            console.log('Camera position:', camera.position);
            console.log('Camera direction:', camera.direction);
            console.log('Camera plane:', camera.plane);
            
            // Generate rays like the renderer does
            // For ap-e6 at x=120, y between 400-440, we need rays that will hit it
            // The camera is at ~[80.7, 380.2], so rays going roughly towards [120, 420] should work
            
            // Let's find what screen position would hit ap-e6
            // screen ranges from camera.screen[0] to camera.screen[1]
            // We need to interpolate to create the right ray
            
            const resolution = 640; // typical resolution
            const rayDirections: Vector[] = [];
            for (let i = 0; i < resolution; i++) {
                const t = i / (resolution - 1);
                // Ray direction = direction + plane * (2*t - 1)
                const dx = camera.direction[0] + camera.plane[0] * (2 * t - 1);
                const dy = camera.direction[1] + camera.plane[1] * (2 * t - 1);
                rayDirections.push([dx, dy]);
            }
            
            // Options that match castCollisionRays (used for 3D rendering)
            const options = {
                edgeFilter: (edge: any) => !!edge.material,
                earlyExitPredicate: (hit: RayHit) => hit.edge.material ? !isTranslucent(hit.intersection.face, hit.edge.material) : false
            };
            
            // Direct intersection - find which rays hit ap-e6
            const raysHittingApE6Direct: number[] = [];
            for (let i = 0; i < resolution; i++) {
                const ray = makeRay(camera.position, rayDirections[i]);
                const result = intersectRayPolygons(geometry.polygons, ray, options);
                if (result.hits.some(h => h.edge.id === 'ap-e6')) {
                    raysHittingApE6Direct.push(i);
                }
            }
            console.log('Direct: rays hitting ap-e6:', raysHittingApE6Direct.length, 
                        'range:', raysHittingApE6Direct[0], '-', raysHittingApE6Direct[raysHittingApE6Direct.length - 1]);
            
            // Try multiple BSP builds
            let failures = 0;
            const attempts = 10;
            for (let attempt = 0; attempt < attempts; attempt++) {
                const bsp = buildBspTree(geometry.polygons);
                
                const raysHittingApE6BSP: number[] = [];
                let missingRays: number[] = [];
                
                for (let i = 0; i < resolution; i++) {
                    const ray = makeRay(camera.position, rayDirections[i]);
                    const result = intersectRay(bsp, ray, options);
                    if (result.hits.some(h => h.edge.id === 'ap-e6')) {
                        raysHittingApE6BSP.push(i);
                    } else if (raysHittingApE6Direct.includes(i)) {
                        // This ray SHOULD hit ap-e6 but BSP didn't find it
                        missingRays.push(i);
                    }
                }
                
                if (missingRays.length > 0) {
                    failures++;
                    console.log(`\nAttempt ${attempt}: BSP missed ${missingRays.length} rays that should hit ap-e6`);
                    console.log('  Missing ray indices:', missingRays.slice(0, 10).join(', '), missingRays.length > 10 ? '...' : '');
                    
                    // Debug one missing ray
                    const debugRayIndex = missingRays[0];
                    const debugRay = makeRay(camera.position, rayDirections[debugRayIndex]);
                    const bspResultDebug = intersectRay(bsp, debugRay, {});  // No filter to see all hits
                    console.log('  Debug ray', debugRayIndex, 'BSP hits:', bspResultDebug.hits.length);
                    bspResultDebug.hits.slice(0, 5).forEach(h => 
                        console.log('    ', h.edge.id, h.edge.start.vector, '->', h.edge.end.vector, 'immaterial:', h.edge.immaterial));
                }
            }
            
            console.log(`\nFailures: ${failures}/${attempts}`);
            expect(failures).toBe(0);
        });
        
        it('should consistently find ap-e6 with castCollisionRays options', () => {
            // Load actual maze.json
            const mapPath = path.join(__dirname, '../../../../assets/maps/maze.json');
            const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            const geometry = loadGeometry(mapData.geometry as IStoredGeometry);
            
            // Camera from maze.json
            const rayPos: Vector = [80.74874268873268, 380.24959794562034];
            // Target the middle of ap-e6
            const target: Vector = [120, 420];
            const rayDir = subtract(target, rayPos);
            const ray = makeRay(rayPos, rayDir);
            
            // Options that match castCollisionRays (used for 3D rendering)
            const options = {
                edgeFilter: (edge: any) => !!edge.material,
                earlyExitPredicate: (hit: RayHit) => hit.edge.material ? !isTranslucent(hit.intersection.face, hit.edge.material) : false
            };
            
            // Direct intersection (always works)
            const directResult = intersectRayPolygons(geometry.polygons, ray, options);
            const directApE6 = directResult.hits.filter(h => h.edge.id === 'ap-e6');
            console.log('Direct finds ap-e6:', directApE6.length > 0);
            
            // Try multiple BSP builds
            let failures = 0;
            const attempts = 30;
            for (let i = 0; i < attempts; i++) {
                const bsp = buildBspTree(geometry.polygons);
                const bspResult = intersectRay(bsp, ray, options);
                
                // Check if ap-e6 specifically is found
                const apE6Found = bspResult.hits.some(h => h.edge.id === 'ap-e6');
                
                if (!apE6Found) {
                    failures++;
                    console.log(`\nAttempt ${i}: BSP did NOT find ap-e6!`);
                    console.log('  BSP found', bspResult.hits.length, 'total hits');
                    bspResult.hits.forEach(h => console.log('    BSP hit:', h.edge.id, h.edge.start.vector, '->', h.edge.end.vector, 'dist:', h.distance));
                    console.log('  result.stop:', bspResult.stop);
                }
            }
            
            console.log(`\nFailures: ${failures}/${attempts}`);
            expect(failures).toBe(0);
        });
        
        it('should find ap-e6 in actual maze data', () => {
            // Load actual maze.json
            const mapPath = path.join(__dirname, '../../../../assets/maps/maze.json');
            const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            const geometry = loadGeometry(mapData.geometry as IStoredGeometry);
            
            console.log('Loaded', geometry.polygons.length, 'polygons from maze.json');
            
            // Find the angled-passage polygon and its ap-e6 edge
            const ap = geometry.polygons.find(p => p.id === 'angled-passage');
            expect(ap).toBeDefined();
            
            const apE6 = ap!.edges.find(e => e.id === 'ap-e6');
            expect(apE6).toBeDefined();
            console.log('ap-e6:', apE6!.start.vector, '->', apE6!.end.vector);
            
            // Build BSP
            const bsp = buildBspTree(geometry.polygons);
            
            // Camera from maze.json
            const rayPos: Vector = [74.16354286886832, 374.1148491054104];
            // Target the middle of ap-e6
            const target: Vector = [120, 420];
            const rayDir = subtract(target, rayPos);
            const ray = makeRay(rayPos, rayDir);
            
            // Direct intersection
            const directResult = intersectRayPolygons(geometry.polygons, ray, {});
            console.log('Direct hits:', directResult.hits.length);
            const directX120 = directResult.hits.filter(h => 
                h.edge.start.vector[0] === 120 && h.edge.end.vector[0] === 120
            );
            console.log('Direct hits at x=120:', directX120.length);
            directX120.forEach(h => {
                console.log('  Direct:', h.edge.id, h.edge.start.vector, '->', h.edge.end.vector);
            });
            
            // BSP intersection
            const bspResult = intersectRay(bsp, ray, {});
            console.log('BSP hits:', bspResult.hits.length);
            const bspX120 = bspResult.hits.filter(h => 
                h.edge.start.vector[0] === 120 && h.edge.end.vector[0] === 120
            );
            console.log('BSP hits at x=120:', bspX120.length);
            bspX120.forEach(h => {
                console.log('  BSP:', h.edge.id, h.edge.start.vector, '->', h.edge.end.vector);
            });
            
            // BSP should find at least what direct finds (may find more from overlapping polygons)
            // The critical check is that ap-e6 is found
            const bspHasApE6 = bspX120.some(h => h.edge.id === 'ap-e6');
            const directHasApE6 = directX120.some(h => h.edge.id === 'ap-e6');
            expect(directHasApE6).toBe(true);
            expect(bspHasApE6).toBe(true);
            expect(bspX120.length).toBeGreaterThanOrEqual(directX120.length);
        });
        
        it('should verify ap-e6 exists in BSP after construction', () => {
            // Load actual maze.json
            const mapPath = path.join(__dirname, '../../../../assets/maps/maze.json');
            const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            const geometry = loadGeometry(mapData.geometry as IStoredGeometry);
            
            // Build BSP
            const bsp = buildBspTree(geometry.polygons);
            
            // Collect all edges from BSP
            const allEdges: {id: string, start: Vector, end: Vector, immaterial: boolean}[] = [];
            const collectEdges = (node: IBSPNode) => {
                if (isLeafNode(node)) {
                    node.polygons.forEach(p => {
                        p.edges.forEach(e => {
                            allEdges.push({
                                id: e.id ?? 'unknown',
                                start: e.start.vector,
                                end: e.end.vector,
                                immaterial: e.immaterial ?? false
                            });
                        });
                    });
                } else if (isSplitNode(node)) {
                    node.coplanar.forEach(p => {
                        p.edges.forEach(e => {
                            allEdges.push({
                                id: e.id ?? 'unknown',
                                start: e.start.vector,
                                end: e.end.vector,
                                immaterial: e.immaterial ?? false
                            });
                        });
                    });
                    collectEdges(node.front);
                    collectEdges(node.back);
                }
            };
            collectEdges(bsp);
            
            // Find ap-e6 or any edge at x=120 between y=400 and y=440
            const verticalEdgesAtX120 = allEdges.filter(e => 
                e.start[0] === 120 && e.end[0] === 120 && !e.immaterial
            );
            
            console.log('Vertical edges at x=120 in BSP:', verticalEdgesAtX120.length);
            verticalEdgesAtX120.forEach(e => {
                console.log('  ', e.id, ':', e.start, '->', e.end);
            });
            
            // Look for ap-e6 specifically or any edge that covers [120,400]-[120,440]
            const apE6InBsp = allEdges.find(e => e.id === 'ap-e6');
            console.log('ap-e6 found directly:', !!apE6InBsp);
            
            // The edge should exist (possibly split)
            expect(verticalEdgesAtX120.length).toBeGreaterThan(0);
        });
    });
});
