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

export interface IDisposableHandlers {
    handlers: IActionHandler[];
    dispose: () => void;
}

export function createGlobalActionHandlers(): IDisposableHandlers {
    const handlers = [
        new CameraActionsHandler(),
        new GlobalActionsHandler(),
    ]
    .map(_ => _.register(window));

    return {
        handlers,
        dispose: () => handlers.forEach(h => h.dispose())
    };
}

export function createCanvasHandlers(canvas: HTMLCanvasElement, spaceTranslator: ISpaceTranslator): IDisposableHandlers {
    
    const blockingHandlers = [
        new EdgeSplitter(canvas.getContext('2d'), spaceTranslator),
        new PolygonExpander(canvas.getContext('2d'), spaceTranslator),
        new PolygonRotator(canvas.getContext('2d'), spaceTranslator)
    ];
    const handlers = [
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
    
    return {
        handlers,
        dispose: () => handlers.forEach(h => h.dispose())
    };
}