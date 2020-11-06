// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

let canvas = document.getElementById('myCanvas') as HTMLCanvasElement;;
let context = canvas.getContext('2d');

context.beginPath();
context.rect(188, 50, 200, 100);
context.fillStyle = 'yellow';
context.fill();
context.lineWidth = 7;
context.strokeStyle = 'black';
context.stroke();
