import { castRays } from './raycaster';
import { adaptAngle, adaptDepth, changeLocation, ICamera, IRay, makeDirectionRay, makeStrafeRay, move, rotate, strafe } from "./camera";
import { World } from "./world";
import { add, normalize, subtract } from './vector';
import { lineAngle } from './lineSegment';
import { segmentFrom } from './vertex';

export type Action = "turnleft"|"turnright"|"right"|"left"|"up"|"down"
    |"camera_angle_up"|"camera_angle_down"|"camera_depth_up"|"camera_depth_down"
    |"save_world";


export type ActiveActions = {[key in Action]: boolean};

export class ActionHandler {
    constructor(private actions: ActiveActions, private world: World) {}

    handle() {
        if (this.actions.turnleft) this.world.camera = rotate(-0.15, this.world.camera);
        if (this.actions.turnright) this.world.camera = rotate(0.15, this.world.camera);
        if (this.actions.left) this.world.camera = this.strafe(-1);
        if (this.actions.right) this.world.camera = this.strafe(1);
        if (this.actions.up) this.world.camera = this.move(1);
        if (this.actions.down) this.world.camera = this.move(-1);

        if (this.actions.camera_angle_up)   this.world.camera = adaptAngle( 1, this.world.camera);
        if (this.actions.camera_angle_down) this.world.camera = adaptAngle(-1, this.world.camera);
        if (this.actions.camera_depth_up)   this.world.camera = adaptDepth( 1, this.world.camera);
        if (this.actions.camera_depth_down) this.world.camera = adaptDepth(-1, this.world.camera);

        if (this.actions.save_world) localStorage.setItem('world', JSON.stringify(this.world));
    }

    private move = (direction: 1|-1): ICamera => this.safeMove(direction, this.world.camera, move, makeDirectionRay);
    private strafe = (direction: 1|-1): ICamera => this.safeMove(direction, this.world.camera, strafe, makeStrafeRay);

    // TODO: this should move to camera
    private safeMove(direction: 1|-1, cam: ICamera, 
        mover: (ratio: number, cam: ICamera) => ICamera, 
        raymaker: (direction: 1|-1, cam: ICamera)=>IRay): ICamera {
        
        const hit = castRays([raymaker(direction, cam)], this.world.geometry)[0].hits[0];    
        if (hit.distance >= 2) { // magic number 2 should actually depend on size of direction/plane vector and 0.15 scale increment above (prevent overshooting the wall)
            return mover(direction * 0.15, cam);
        }

        const s = segmentFrom(hit.edge);
        const collisionAngle = Math.abs(lineAngle(s, hit.ray.line))-Math.PI/2;
        if (Math.abs(collisionAngle) > Math.PI/8) {
            // TODO: size of target should depend on angle => faster when angle is further from PI/2
            const target = normalize(collisionAngle < 0 ? subtract(s[1], s[0]) : subtract(s[0], s[1]));
            return this.safeMove(direction, cam,                 
                (_r, c)=> changeLocation(target, c), // move function
                (_d, c) => ({angle: 0, line: [c.position, add(c.position, target)]})); // ray creation function
        }

        return cam;
    }
}