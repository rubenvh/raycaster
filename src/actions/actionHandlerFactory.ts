import { CameraActionsHandler } from './cameraActionsHandler';
import { spaceTranslator, GeometrySelector } from './geometrySelector';
import { World } from '../world';
import { IActionHandler } from './actions';
import { EdgeSplitter } from './edgeSplitter';
import { GeometryMover } from './geometryMover';
import { GlobalActionsHandler } from './globalActionHandler';
import { EdgeRemover } from './edgeRemover';

export function createGlobalActionHandlers(world: World): IActionHandler[] {
    return [
        new CameraActionsHandler(world),
        new GlobalActionsHandler(world),
    ]
    .map(_ => _.register(window));

}

export function createCanvasHandlers(canvas: HTMLCanvasElement, world: World): IActionHandler[] {
    const t = spaceTranslator(canvas);

    return [
            new GeometrySelector(t, world),
            new GeometryMover(t, world),
            new EdgeSplitter(canvas.getContext('2d'), t, world),
            new EdgeRemover(world),
        ]
        .map(_ => _.register(canvas));
}