/**
 * Factory for creating IMaterial and IDirectedMaterial test data.
 */
import { Factory } from 'fishery';
import { Color, IDirectedMaterial, IMaterial } from '../../geometry/properties';
import { ITextureReference } from '../../textures/model';
import { testRandom } from '../seeded-random';

/**
 * Generate a random color.
 */
const randomColor = (alpha: number = 1): Color => [
    testRandom.nextInt(0, 255),
    testRandom.nextInt(0, 255),
    testRandom.nextInt(0, 255),
    alpha
];

/**
 * Common color presets for tests.
 */
export const COLORS = {
    red: [255, 0, 0, 1] as Color,
    green: [0, 255, 0, 1] as Color,
    blue: [0, 0, 255, 1] as Color,
    white: [255, 255, 255, 1] as Color,
    black: [0, 0, 0, 1] as Color,
    transparent: [0, 0, 0, 0] as Color,
    semiTransparent: [128, 128, 128, 0.5] as Color,
};

class MaterialFactory extends Factory<IMaterial> {
    /**
     * Create a fully opaque material.
     */
    opaque() {
        return this.params({
            color: randomColor(1)
        });
    }

    /**
     * Create a translucent material with specified alpha.
     */
    translucent(alpha: number = 0.5) {
        return this.params({
            color: randomColor(alpha)
        });
    }

    /**
     * Create an invisible material (alpha = 0).
     */
    invisible() {
        return this.params({
            color: randomColor(0)
        });
    }

    /**
     * Create a material with a specific color.
     */
    withColor(color: Color) {
        return this.params({ color });
    }

    /**
     * Create a material with a texture.
     */
    textured(texture?: ITextureReference) {
        return this.params({
            texture: texture ?? { id: `texture-${testRandom.nextInt(1, 100)}`, index: 0 }
        });
    }

    /**
     * Create a red material (useful for visibility in tests).
     */
    red(alpha: number = 1) {
        return this.withColor([255, 0, 0, alpha]);
    }

    /**
     * Create a blue material (useful for visibility in tests).
     */
    blue(alpha: number = 1) {
        return this.withColor([0, 0, 255, alpha]);
    }
}

export const materialFactory = MaterialFactory.define<IMaterial>(() => ({
    color: randomColor(),
}));

/**
 * Factory for creating directed materials (front/back faces).
 */
class DirectedMaterialFactory extends Factory<IDirectedMaterial> {
    /**
     * Create a single-sided material (same on both faces).
     */
    singleSided() {
        return this.params(materialFactory.build());
    }

    /**
     * Create a double-sided material with different front/back.
     */
    doubleSided(front?: IMaterial, back?: IMaterial) {
        return this.params([
            front ?? materialFactory.build(),
            back ?? materialFactory.build()
        ] as [IMaterial, IMaterial]);
    }
}

export const directedMaterialFactory = DirectedMaterialFactory.define<IDirectedMaterial>(() => 
    materialFactory.build()
);
