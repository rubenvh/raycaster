import { 
    Color, Face, IMaterial, IDirectedMaterial,
    hasDirection, cloneMaterial, isTranslucent, getMaterial,
    applyTexture, toggleTexture, setTexture
} from './properties';
import { ITextureReference } from '../textures/model';

describe('properties tests', () => {
    describe('Face enum', () => {
        it('interior is 0', () => expect(Face.interior).toBe(0));
        it('exterior is 1', () => expect(Face.exterior).toBe(1));
    });

    describe('hasDirection', () => {
        it('returns true for array of two materials', () => {
            const directed: IDirectedMaterial = [
                { color: [255, 0, 0, 1] },
                { color: [0, 255, 0, 1] }
            ];
            expect(hasDirection(directed)).toBe(true);
        });

        it('returns false for single material', () => {
            const single: IMaterial = { color: [255, 0, 0, 1] };
            expect(hasDirection(single)).toBe(false);
        });

        it('returns false for null', () => {
            expect(hasDirection(null as any)).toBe(false);
        });
    });

    describe('getMaterial', () => {
        it('returns single material for both faces', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            expect(getMaterial(Face.interior, material)).toBe(material);
            expect(getMaterial(Face.exterior, material)).toBe(material);
        });

        it('returns correct material from directed material', () => {
            const interior: IMaterial = { color: [255, 0, 0, 1] };
            const exterior: IMaterial = { color: [0, 255, 0, 1] };
            const directed: IDirectedMaterial = [interior, exterior];
            
            expect(getMaterial(Face.interior, directed)).toBe(interior);
            expect(getMaterial(Face.exterior, directed)).toBe(exterior);
        });

        it('returns null for null material', () => {
            expect(getMaterial(Face.interior, null as any)).toBeNull();
        });
    });

    describe('isTranslucent', () => {
        it('returns false for fully opaque material (alpha = 1)', () => {
            const opaque: IMaterial = { color: [255, 0, 0, 1] };
            expect(isTranslucent(Face.interior, opaque)).toBe(false);
        });

        it('returns true for semi-transparent material (alpha < 1)', () => {
            const translucent: IMaterial = { color: [255, 0, 0, 0.5] };
            expect(isTranslucent(Face.interior, translucent)).toBe(true);
        });

        it('returns true for fully transparent material (alpha = 0)', () => {
            const transparent: IMaterial = { color: [255, 0, 0, 0] };
            expect(isTranslucent(Face.interior, transparent)).toBe(true);
        });

        it('handles directed materials correctly', () => {
            const directed: IDirectedMaterial = [
                { color: [255, 0, 0, 0.5] }, // translucent interior
                { color: [0, 255, 0, 1] }    // opaque exterior
            ];
            expect(isTranslucent(Face.interior, directed)).toBe(true);
            expect(isTranslucent(Face.exterior, directed)).toBe(false);
        });
    });

    describe('cloneMaterial', () => {
        it('clones single material', () => {
            const original: IMaterial = { color: [255, 128, 64, 0.5], luminosity: 0.8 };
            const cloned = cloneMaterial(original) as IMaterial;
            
            expect(cloned).not.toBe(original);
            expect(cloned.color).toEqual(original.color);
            expect(cloned.color).not.toBe(original.color); // deep clone
            expect(cloned.luminosity).toBe(original.luminosity);
        });

        it('clones directed material', () => {
            const original: IDirectedMaterial = [
                { color: [255, 0, 0, 1] },
                { color: [0, 255, 0, 1] }
            ];
            const cloned = cloneMaterial(original) as [IMaterial, IMaterial];
            
            expect(cloned).not.toBe(original);
            expect(cloned[0].color).toEqual(original[0].color);
            expect(cloned[1].color).toEqual(original[1].color);
        });

        it('clones material with texture', () => {
            const texture: ITextureReference = { id: 'tex-1', index: 0 };
            const original: IMaterial = { color: [255, 0, 0, 1], texture };
            const cloned = cloneMaterial(original) as IMaterial;
            
            expect(cloned.texture).toEqual(texture);
            expect(cloned.texture).not.toBe(texture); // deep clone
        });

        it('returns null for null material', () => {
            expect(cloneMaterial(null as any)).toBeNull();
        });
    });

    describe('applyTexture', () => {
        const texture: ITextureReference = { id: 'new-tex', index: 1 };
        const applier = (m: IMaterial, t: ITextureReference): IMaterial => ({ ...m, texture: t });

        it('applies texture to single material for interior face', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            const result = applyTexture(Face.interior, material, texture, applier);
            
            expect((result as IMaterial).texture).toEqual(texture);
        });

        it('converts to directed material when applying to exterior face of single material', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            const result = applyTexture(Face.exterior, material, texture, applier);
            
            expect(Array.isArray(result)).toBe(true);
            const directed = result as [IMaterial, IMaterial];
            expect(directed[Face.interior].texture).toBeUndefined();
            expect(directed[Face.exterior].texture).toEqual(texture);
        });

        it('applies texture to correct face of directed material', () => {
            const directed: IDirectedMaterial = [
                { color: [255, 0, 0, 1] },
                { color: [0, 255, 0, 1] }
            ];
            
            const result = applyTexture(Face.interior, directed, texture, applier);
            expect((result as [IMaterial, IMaterial])[Face.interior].texture).toEqual(texture);
            expect((result as [IMaterial, IMaterial])[Face.exterior].texture).toBeUndefined();
        });
    });

    describe('toggleTexture', () => {
        const texture: ITextureReference = { id: 'tex-1', index: 0 };

        it('adds texture when none exists', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            const result = toggleTexture(material, texture);
            
            expect(result.texture).toEqual(texture);
        });

        it('removes texture when one exists', () => {
            const material: IMaterial = { color: [255, 0, 0, 1], texture };
            const result = toggleTexture(material, texture);
            
            expect(result.texture).toBeNull();
        });

        it('mutates the original material', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            const result = toggleTexture(material, texture);
            
            expect(result).toBe(material);
        });
    });

    describe('setTexture', () => {
        const texture: ITextureReference = { id: 'tex-1', index: 0 };

        it('sets texture on material', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            const result = setTexture(material, texture);
            
            expect(result.texture).toEqual(texture);
        });

        it('overwrites existing texture', () => {
            const oldTexture: ITextureReference = { id: 'old', index: 0 };
            const material: IMaterial = { color: [255, 0, 0, 1], texture: oldTexture };
            const result = setTexture(material, texture);
            
            expect(result.texture).toEqual(texture);
        });

        it('mutates the original material', () => {
            const material: IMaterial = { color: [255, 0, 0, 1] };
            const result = setTexture(material, texture);
            
            expect(result).toBe(material);
        });
    });
});
