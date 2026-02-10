import { EMPTY_GEOMETRY } from "../geometry/geometry";
import { useAppDispatch } from "../store";
import { CAMERA_MOVE_SPEED, CAMERA_ROTATION_SPEED, changeCameraAngle, changeCameraDepth, moveCamera, rotateCamera, strafeCamera } from "../store/player";
import { connect } from "../store/store-connector";
import { bindFlagToKey, Flag, IActionHandler, makeFlag } from "./actions";

const CAMERA_ACTIONS = ["turnleft","turnright","right","left","up","down",
"camera_angle_up","camera_angle_down","camera_depth_up","camera_depth_down"] as const;
type CameraAction = typeof CAMERA_ACTIONS[number];

const dispatch = useAppDispatch();

export class CameraActionsHandler implements IActionHandler {
        
    private flags: {[key in CameraAction]: Flag};
    private wallGeometry = EMPTY_GEOMETRY;
    private unsubscribe: () => void;
    private cleanupFunctions: (() => void)[] = [];

    constructor() {
        this.unsubscribe = connect(s => {            
            this.wallGeometry = s.walls.geometry;
        });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.flags = CAMERA_ACTIONS.reduce((acc, x) => {
            const flag = makeFlag();
            const cleanup = bindFlagToKey(g, x, flag);
            this.cleanupFunctions.push(cleanup);
            return ({...acc, [x]: flag});
        }, {} as {[key in CameraAction]: Flag});
        return this;        
    }

    dispose(): void {
        this.unsubscribe();
        this.cleanupFunctions.forEach(fn => fn());
        this.cleanupFunctions = [];
    }

    handle(deltaTime: number) {
        // Scale movement by deltaTime for frame-rate independent movement
        const rotationAmount = CAMERA_ROTATION_SPEED * deltaTime;
        const moveSpeed = CAMERA_MOVE_SPEED * deltaTime;
        
        if (this.flags.turnleft.value) dispatch(rotateCamera(-rotationAmount));
        if (this.flags.turnright.value) dispatch(rotateCamera(rotationAmount));
        if (this.flags.left.value) this.strafe(-1, moveSpeed);
        if (this.flags.right.value) this.strafe(1, moveSpeed);
        if (this.flags.up.value) this.move(1, moveSpeed);
        if (this.flags.down.value) this.move(-1, moveSpeed);

        if (this.flags.camera_angle_up.value)   dispatch(changeCameraAngle( 1 ));
        if (this.flags.camera_angle_down.value) dispatch(changeCameraAngle(-1 ));
        if (this.flags.camera_depth_up.value)   dispatch(changeCameraDepth( 1 ));
        if (this.flags.camera_depth_down.value) dispatch(changeCameraDepth(-1 ));
    }

    isActive = () => true;

    private move = (direction: 1|-1, speed: number) => dispatch(moveCamera({direction, geometry: this.wallGeometry, speed}));
    private strafe = (direction: 1|-1, speed: number) => dispatch(strafeCamera({direction, geometry: this.wallGeometry, speed}));     
}