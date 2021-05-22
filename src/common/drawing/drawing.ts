import { BoundingBox } from "../geometry/polygon";
import { ILineSegment } from "../math/lineSegment";
import { Plane } from "../math/plane";
import { dot, Vector } from "../math/vector";

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

export const drawPlane = (context: CanvasRenderingContext2D, plane: Plane, color: string='green'): void => {

    context.beginPath();
	context.strokeStyle = color;;
	context.lineWidth = 2;

    if (plane.n[1] !== 0) {
        const max = context.canvas.width;
        for (var i=0; i<=max; i+=max)
        {		
            let x = i;
            let y = (plane.d - plane.n[0]*i)/plane.n[1];
    
            if(i===0) {
                context.moveTo(x,y);
            } else {
                context.lineTo(x,y);
            }
        }
    } else if (plane.n[0] !== 0) {
        const max = context.canvas.height;
        for (var i=0; i<=max; i+=max)
        {		
            let y = i;
            let x = (plane.d - plane.n[1]*i)/plane.n[0];
    
            if(i===0) {
                context.moveTo(x,y);
            } else {
                context.lineTo(x,y);
            }
        }
    }

    
	context.stroke();    
}
