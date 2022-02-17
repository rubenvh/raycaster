export interface IRenderer {
    isActive(): boolean;
    render(fps: number): void;
}