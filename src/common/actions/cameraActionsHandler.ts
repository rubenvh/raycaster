import { norm } from "../math/vector";
import { EMPTY_GEOMETRY } from "../geometry/geometry";
import { useAppDispatch } from "../store";
import { CAMERA_MOVE_SPEED, CAMERA_ROTATION_SPEED, changeCameraAngle, changeCameraDepth, moveCamera, rotateCamera, strafeCamera } from "../store/player";
import { connect } from "../store/store-connector";
import { bindFlagToKey, Flag, IActionHandler, makeFlag } from "./actions";
import { ICamera } from "../camera";
import { IBspContext } from "../store/bsp-state";

const CAMERA_ACTIONS = ["turnleft","turnright","right","left","up","down",
"camera_angle_up","camera_angle_down","camera_depth_up","camera_depth_down"] as const;
type CameraAction = typeof CAMERA_ACTIONS[number];

const dispatch = useAppDispatch();

export class CameraActionsHandler implements IActionHandler {
        
    private flags: {[key in CameraAction]: Flag};
    private wallGeometry = EMPTY_GEOMETRY;
    private bspContext: IBspContext | null = null;
    private camera: ICamera;
    private shiftHeld = false;
    private unsubscribe: () => void;
    private cleanupFunctions: (() => void)[] = [];

    constructor() {
        this.unsubscribe = connect(s => {            
            this.wallGeometry = s.walls.geometry;
            this.camera = s.player.camera;
            this.bspContext = { tree: s.bsp.tree, dirtyEdges: s.bsp.dirtyEdges };
        });
    }

    register(g: GlobalEventHandlers): IActionHandler {
        this.flags = CAMERA_ACTIONS.reduce((acc, x) => {
            const flag = makeFlag();
            const cleanup = bindFlagToKey(g, x, flag);
            this.cleanupFunctions.push(cleanup);
            return ({...acc, [x]: flag});
        }, {} as {[key in CameraAction]: Flag});

        const shiftDownHandler = (event: KeyboardEvent) => {
            if (event.key === 'Shift') this.shiftHeld = true;
        };
        const shiftUpHandler = (event: KeyboardEvent) => {
            if (event.key === 'Shift') this.shiftHeld = false;
        };
        g.addEventListener("keydown", shiftDownHandler, false);
        g.addEventListener("keyup", shiftUpHandler, false);
        this.cleanupFunctions.push(() => {
            g.removeEventListener("keydown", shiftDownHandler, false);
            g.removeEventListener("keyup", shiftUpHandler, false);
        });

        return this;        
    }

    dispose(): void {
        this.unsubscribe();
        this.cleanupFunctions.forEach(fn => fn());
        this.cleanupFunctions = [];
    }

    handle(deltaTime: number) {
        // When Shift is held, move exactly 1 world unit per frame
        // speed * norm(direction) = step size in world units
        // So speed = 1 / norm(direction) gives exactly 1 unit per frame
        const dirNorm = this.camera ? norm(this.camera.direction) : 10;
        const slowSpeed = 0.5 / dirNorm;

        const rotationAmount = this.shiftHeld ? slowSpeed : CAMERA_ROTATION_SPEED * deltaTime;
        const moveSpeed = this.shiftHeld ? slowSpeed : CAMERA_MOVE_SPEED * deltaTime;
        
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

    private move = (direction: 1|-1, speed: number) => dispatch(moveCamera({direction, geometry: this.wallGeometry, bspContext: this.bspContext, speed}));
    private strafe = (direction: 1|-1, speed: number) => dispatch(strafeCamera({direction, geometry: this.wallGeometry, bspContext: this.bspContext, speed}));     
}
