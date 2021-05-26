import { BoundingBox } from "../geometry/polygon";
import { ILineSegment } from "../math/lineSegment";
import { getBounds, isPlaneSemiHorizontal, Plane } from "../math/plane";
import { Vector } from "../math/vector";

export const drawVector = (context: CanvasRenderingContext2D, vector: Vector, color: string = 'rgb(100,100,0)') => {
    context.beginPath();
    context.arc(vector[0], vector[1], 2, 0, 2*Math.PI, false);
    context.fillStyle = color;
    context.fill();
}

export const drawSegment = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'white', lineWidth: number = 1) => {
    context.beginPath();
    context.moveTo(segment[0][0], segment[0][1]);
    context.lineTo(segment[1][0], segment[1][1]);
    context.lineWidth = lineWidth;
    context.setLineDash([]);
    context.strokeStyle = color;
    context.stroke();
};

export const drawRect = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string|CanvasGradient = 'rgb(0,0,255)') => {
    const x1 = segment[0][0],
          y1 = segment[0][1],
          x2 = segment[1][0],
          y2 = segment[1][1];
    context.fillStyle = color;    
    context.fillRect(x1, y1, x2-x1, y2-y1);
};   

export const drawBoundingBox = (context: CanvasRenderingContext2D, boundingBox: BoundingBox, color: string = 'rgb(150,100,50,0.8)') => {
    const x1 = boundingBox[0][0]-5,
          y1 = boundingBox[0][1]-5,
          x2 = boundingBox[1][0]+5,
          y2 = boundingBox[1][1]+5;    
    context.strokeStyle = color;        
    context.lineWidth = 1;
    context.setLineDash([4, 2]);
    context.strokeRect(x1, y1, x2-x1, y2-y1);
}

export const drawTrapezoid = (context: CanvasRenderingContext2D, p: [Vector, Vector, Vector, Vector], color: string|CanvasGradient): void => {    
    context.beginPath();    
    context.moveTo(p[0][0], p[0][1]);
    context.lineTo(p[1][0], p[1][1]);
    context.lineTo(p[2][0], p[2][1]);
    context.lineTo(p[3][0], p[3][1]);
    context.closePath();    
    context.fillStyle = color;
    context.fill();
};

export const drawPlane = (context: CanvasRenderingContext2D, plane: Plane, color: string='green', clipRegion: Path2D[]): [Path2D, Path2D] => {

    context.save();
    for (const p of clipRegion) { context.clip(p); }

    context.beginPath();    
	context.strokeStyle = color;
	context.lineWidth = 2;

    const [xMax, yMax] = [context.canvas.width, context.canvas.height];
    const [[x1, y1],[x2, y2]] = getBounds(plane, xMax, yMax);
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);    
	context.stroke();    
    context.closePath();    


    context.restore();
    
    if (isPlaneSemiHorizontal(plane)) {
        return [
            createClipTrapezoid([0,0],[x1,y1],[x2,y2],[xMax, 0]),
            createClipTrapezoid([0,yMax], [x1,y1],[x2,y2],[xMax,yMax])
        ];
    } else {        
        return [
            createClipTrapezoid([0,0],[x1,y1],[x2,y2],[0,yMax]),
            createClipTrapezoid([xMax,0], [x1,y1],[x2,y2],[xMax,yMax])
        ];
    }
}

const createClipTrapezoid = (...p: [Vector, Vector, Vector, Vector]) => {
    let result = new Path2D();
    result.moveTo(p[0][0], p[0][1]);
    result.lineTo(p[1][0], p[1][1]);
    result.lineTo(p[2][0], p[2][1]);
    result.lineTo(p[3][0], p[3][1]);
    result.closePath();    
    return result;
}
