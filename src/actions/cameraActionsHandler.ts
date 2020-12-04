import { adaptAngle, adaptDepth, ICamera, move, rotate, strafe } from "../camera";
import { World } from "../world";
import { Action, ALL_ACTIONS, bindFlagToKey, Flag, IActionHandler, makeFlag } from "./actions";

const CAMERA_ACTIONS = ["turnleft","turnright","right","left","up","down",
"camera_angle_up","camera_angle_down","camera_depth_up","camera_depth_down"] as const;
type CameraAction = typeof CAMERA_ACTIONS[number];

export class CameraActionsHandler implements IActionHandler {
    
    
    private flags: {[key in CameraAction]: Flag};
    
    constructor(private world: World) {}

    register(g: GlobalEventHandlers): IActionHandler {
        this.flags = CAMERA_ACTIONS.reduce((acc, x) => {
            const flag = makeFlag();
            bindFlagToKey(g, x, flag);
            return ({...acc, [x]: flag});
        }, {} as {[key in CameraAction]: Flag});
        return this;        
    }

    handle() {
        // TODO: speed of movement is partially here (rotation) and partially inside camera
        // (what about a running mode ? )        
        if (this.flags.turnleft.value) this.world.camera = rotate(-0.15, this.world.camera);
        if (this.flags.turnright.value) this.world.camera = rotate(0.15, this.world.camera);
        if (this.flags.left.value) this.world.camera = this.strafe(-1);
        if (this.flags.right.value) this.world.camera = this.strafe(1);
        if (this.flags.up.value) this.world.camera = this.move(1);
        if (this.flags.down.value) this.world.camera = this.move(-1);

        if (this.flags.camera_angle_up.value)   this.world.camera = adaptAngle( 1, this.world.camera);
        if (this.flags.camera_angle_down.value) this.world.camera = adaptAngle(-1, this.world.camera);
        if (this.flags.camera_depth_up.value)   this.world.camera = adaptDepth( 1, this.world.camera);
        if (this.flags.camera_depth_down.value) this.world.camera = adaptDepth(-1, this.world.camera);
    }

    private move = (direction: 1|-1): ICamera => move(direction, this.world.camera, this.world.geometry);
    private strafe = (direction: 1|-1): ICamera => strafe(direction, this.world.camera, this.world.geometry);    
}