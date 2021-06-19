import { EdgeModifier } from './edgeModifier';
import { CameraActionsHandler } from './cameraActionsHandler';
import { spaceTranslator, GeometrySelector, ISpaceTranslator } from './geometrySelector';
import { IActionHandler } from './actions';
import { EdgeSplitter } from './edgeSplitter';
import { GeometryMover } from './geometryMover';
import { GlobalActionsHandler } from './globalActionHandler';
import { GeometryRemover } from './geometryRemover';
import { PolygonCreator } from './polygonCreator';
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

export function createCanvasHandlers(canvas: HTMLCanvasElement, spaceTranslator: ISpaceTranslator): IActionHandler[] {
    
    const blockingHandlers = [
        new EdgeSplitter(canvas.getContext('2d'), spaceTranslator),
        new PolygonExpander(canvas.getContext('2d'), spaceTranslator),
        new PolygonRotator(canvas.getContext('2d'), spaceTranslator)
    ];
    return [
            ...blockingHandlers,
            new GeometryMover(spaceTranslator, blockingHandlers),
            new GeometrySelector(canvas.getContext('2d'), spaceTranslator, blockingHandlers),
            new GeometryRemover(),
            new PolygonCreator(canvas.getContext('2d'), spaceTranslator),
            new PolygonSplitter(),
            new EdgeModifier(),
            new PolygonReverser(),
        ]
        .map(_ => _.register(canvas));
}