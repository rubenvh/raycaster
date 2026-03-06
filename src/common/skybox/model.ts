export type ISkyboxRegion = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type ISkyboxSource = {
    id: string;
    data: string;
    mimeType: string;
    width: number;
    height: number;
    region?: ISkyboxRegion;
};
