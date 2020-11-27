import { adaptAngle, adaptDepth, ICamera, move, rotate, strafe } from "./camera";
import { World } from "./world";

export type Action = "turnleft"|"turnright"|"right"|"left"|"up"|"down"
    |"camera_angle_up"|"camera_angle_down"|"camera_depth_up"|"camera_depth_down"
    |"save_world";


export type ActiveActions = {[key in Action]: boolean};

export class ActionHandler {
    constructor(private actions: ActiveActions, private world: World) {}

    handle() {
        // TODO: speed of movement is partially here (rotation) and partially inside camera
        // (what about a running mode ? )

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

    private move = (direction: 1|-1): ICamera => move(direction, this.world.camera, this.world.geometry);
    private strafe = (direction: 1|-1): ICamera => strafe(direction, this.world.camera, this.world.geometry);    
}