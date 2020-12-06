import { BoundingBox } from './../geometry/vertex';
import { ILineSegment } from "../geometry/lineSegment";
import { getX, getY, Vector } from "../geometry/vector";

export const drawVector = (context: CanvasRenderingContext2D, vector: Vector, color: string = 'rgb(100,100,0)') => {
    context.beginPath();
    context.arc(getX(vector), getY(vector), 2, 0, 2*Math.PI, false);
    context.fillStyle = color;
    context.fill();
}

export const drawSegment = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'white', lineWidth: number = 1) => {
    context.beginPath();
    context.moveTo(getX(segment[0]), getY(segment[0]));
    context.lineTo(getX(segment[1]), getY(segment[1]));
    context.lineWidth = lineWidth;
    context.setLineDash([]);
    context.strokeStyle = color;
    context.stroke();
};

export const drawRect = (context: CanvasRenderingContext2D, segment: ILineSegment, color: string = 'rgb(0,0,255)') => {
    const x1 = getX(segment[0]),
          y1 = getY(segment[0]),
          x2 = getX(segment[1]),
          y2 = getY(segment[1]);
    context.beginPath();
    context.fillStyle = color;
    context.fillRect(x1, y1, x2-x1, y2-y1);
};   

export const drawBoundingBox = (context: CanvasRenderingContext2D, boundingBox: BoundingBox, color: string = 'rgb(150,100,50,0.8)') => {
    const x1 = getX(boundingBox[0])-5,
          y1 = getY(boundingBox[0])-5,
          x2 = getX(boundingBox[1])+5,
          y2 = getY(boundingBox[1])+5;
    context.beginPath();
    context.strokeStyle = color;        
    context.lineWidth = 1;
    context.setLineDash([4, 2]);
    context.strokeRect(x1, y1, x2-x1, y2-y1);
}
