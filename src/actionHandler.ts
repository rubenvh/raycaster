import { World } from "./world";

export type Action = "turnleft"|"turnright"|"right"|"left"|"up"|"down"
    |"camera_angle_up"|"camera_angle_down"|"camera_depth_up"|"camera_depth_down";

export type ActiveActions = {[key in Action]: boolean};

export class ActionHandler {
    constructor(private actions: ActiveActions, private world: World) {}

    handle() {
        if (this.actions.turnleft) this.world.camera.rotate(-0.1);
        if (this.actions.turnright) this.world.camera.rotate(0.1);
        if (this.actions.left) this.world.camera.strafe(-0.1);
        if (this.actions.right) this.world.camera.strafe(0.1);
        if (this.actions.up) this.world.camera.move(1/20);
        if (this.actions.down) this.world.camera.move(-1/20);

        if (this.actions.camera_angle_up)   this.world.camera.adaptAngle( 1);
        if (this.actions.camera_angle_down) this.world.camera.adaptAngle(-1);
        if (this.actions.camera_depth_up)   this.world.camera.adaptDepth( 1);
        if (this.actions.camera_depth_down) this.world.camera.adaptDepth(-1);
    }
}