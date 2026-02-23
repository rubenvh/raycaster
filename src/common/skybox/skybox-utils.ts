import { ICamera } from '../camera';

export const computeSkyboxOffset = (camera: ICamera, width: number): number => {
    if (width <= 0) return 0;
    const angle = Math.atan2(camera.direction[1], camera.direction[0]);
    const u = angle / (2 * Math.PI);
    const normalized = u - Math.floor(u);
    return Math.floor(normalized * width);
};
