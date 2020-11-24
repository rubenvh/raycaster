import { castRays } from './raycaster';
import { adaptAngle, adaptDepth, ICamera, IRay, makeDirectionRay, makeStrafeRay, move, rotate, strafe } from "./camera";
import { World } from "./world";

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

    private move = (direction: 1|-1): ICamera => this.safeMove(_ => move(direction*0.15, _), _ => makeDirectionRay(direction, _));
    private strafe = (direction: 1|-1): ICamera => this.safeMove(_ => strafe(direction*0.15, _), _ => makeStrafeRay(direction, _));

    private safeMove(mover: (ICamera)=>ICamera, raymaker: (ICamera)=>IRay): ICamera {
        const hit = castRays([raymaker(this.world.camera)], this.world.geometry)[0].hits[0];
        return (hit && hit.distance >= 2) // magic number 2 should actually depend on size of direction vector and 0.15 scale increment below (prevent overshooting the wall)
            ? mover(this.world.camera) 
            : this.world.camera;  // instead of blocking the move by returning the current camera => move parallel to the hit edge if angle between ray and edge is large enough       
    }
}