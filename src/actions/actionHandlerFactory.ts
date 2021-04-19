import { EdgeModifier } from './edgeModifier';
import { CameraActionsHandler } from './cameraActionsHandler';
import { spaceTranslator, GeometrySelector } from './geometrySelector';
import { IActionHandler } from './actions';
import { EdgeSplitter } from './edgeSplitter';
import { GeometryMover } from './geometryMover';
import { GlobalActionsHandler } from './globalActionHandler';
import { GeometryRemover } from './geometryRemover';
import { PolygonCreator } from './polygonCreator';
import { TextureLibrary } from '../textures/textureLibrary';
import { PolygonExpander } from './polygonExpander';
import { PolygonSplitter } from './polygonSplitter';
import { PolygonRotator } from './polygonRotator';
import { PolygonReverser } from './polygonReverser';

export function createGlobalActionHandlers(): IActionHandler[] {
    return [
        new CameraActionsHandler(),
        new GlobalActionsHandler(),
    ]
    .map(_ => _.register(window));

}

export function createCanvasHandlers(canvas: HTMLCanvasElement, texLib: TextureLibrary): IActionHandler[] {
    const t = spaceTranslator(canvas);

    const blockingHandlers = [
        new EdgeSplitter(canvas.getContext('2d'), t),
        new PolygonExpander(canvas.getContext('2d'), t),
        new PolygonRotator(canvas.getContext('2d'), t)
    ];
    return [
            ...blockingHandlers,
            new GeometryMover(t, blockingHandlers),
            new GeometrySelector(canvas.getContext('2d'), t, blockingHandlers),
            new GeometryRemover(),
            new PolygonCreator(canvas.getContext('2d'), t),
            new PolygonSplitter(),
            new EdgeModifier(texLib),
            new PolygonReverser(),
        ]
        .map(_ => _.register(canvas));
}