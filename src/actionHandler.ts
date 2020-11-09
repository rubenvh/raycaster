import { World } from "./world";

export type Action = "turnleft"|"turnright"|"right"|"left"|"up"|"down";
export type ActiveActions = {[key in Action]: boolean};

export class ActionHandler {
    constructor(private actions: ActiveActions, private world: World) {}

    handle() {
        if (this.actions.turnleft) this.world.camera.rotate(-0.2);
        if (this.actions.turnright) this.world.camera.rotate(0.2);
        if (this.actions.left) this.world.camera.strafe(-0.2);
        if (this.actions.right) this.world.camera.strafe(0.2);
        if (this.actions.up) this.world.camera.move(1/10);
        if (this.actions.down) this.world.camera.move(-1/10);
    }
}