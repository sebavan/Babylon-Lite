import { type GLEffect, type GLEngineContext, setEffectFloat, setEffectTexture } from "babylon-lite-gl";

import { ShaderBinding } from "../runtime/shaderRuntime.js";
import { ShaderBlock } from "../blockFoundation/shaderBlock.js";
import { ConnectionPointType } from "../connection/connectionPointType.js";
import { type RuntimeData } from "../connection/connectionPoint.js";
import { type ShaderProgram } from "../utils/shaderCodeUtils.js";
import { type SmartFilter } from "../smartFilter.js";
import { CreateStrongRef } from "../utils/strongRef.js";

/**
 * The shader program for the block.
 *
 * Authored as GLSL ES 1.0 (calls `texture2D`, reads `vUV`) - the runtime's `GetShaderCreateOptions`
 * transparently rewrites this to GLSL ES 3.00 for lite-gl.
 */
const BlockShaderProgram: ShaderProgram = {
    vertex: undefined,
    fragment: {
        uniform: `
            uniform sampler2D _input_; // main
            uniform float _intensity_;`,
        mainInputTexture: "_input_",
        mainFunctionName: "_pixelate_",
        functions: [
            {
                name: "_pixelate_",
                code: `
                    vec4 _pixelate_(vec2 vUV) {
                        // intensity 0 -> fine grid (near original), intensity 1 -> chunky blocks
                        float gridSize = mix(256.0, 8.0, clamp(_intensity_, 0.0, 1.0));
                        vec2 snapped = (floor(vUV * gridSize) + 0.5) / gridSize;
                        return texture2D(_input_, snapped);
                    }
                    `,
                params: "vec2 vUV",
            },
        ],
    },
};

/**
 * The uniform names for this shader, to be used in the shader binding so
 * that the names are always in sync.
 */
const Uniforms = {
    input: "input",
    intensity: "intensity",
};

/**
 * The shader binding for the PixelateBlock, used by the runtime.
 */
class PixelateBlockShaderBinding extends ShaderBinding {
    private readonly _input: RuntimeData<ConnectionPointType.Texture>;
    private readonly _intensity: RuntimeData<ConnectionPointType.Float>;

    /**
     * Creates a new shader binding instance for the block.
     * @param input - The input texture runtime value
     * @param intensity - The intensity runtime value
     */
    constructor(input: RuntimeData<ConnectionPointType.Texture>, intensity: RuntimeData<ConnectionPointType.Float>) {
        super();
        this._input = input;
        this._intensity = intensity;
    }

    /**
     * Binds all the required data to the shader when rendering.
     * @param engine - defines the engine to bind the data on
     * @param effect - defines the effect to bind the data to
     */
    public override bind(engine: GLEngineContext, effect: GLEffect): void {
        const input = this._input.value;
        if (input) {
            setEffectTexture(engine, effect, this.getRemappedName(Uniforms.input), input);
        }
        setEffectFloat(engine, effect, this.getRemappedName(Uniforms.intensity), this._intensity.value);
    }
}

/**
 * A block that pixelates its input texture by snapping UVs to a grid. The grid coarseness is driven
 * by the `intensity` input (0..1).
 */
export class PixelateBlock extends ShaderBlock {
    /**
     * The class name of the block.
     */
    public static override ClassName = "PixelateBlock";

    /**
     * The namespace of the block.
     */
    public static override Namespace = "Babylon.Demo.Effects";

    /**
     * The input texture connection point.
     */
    public readonly input = this._registerInput(Uniforms.input, ConnectionPointType.Texture);

    /**
     * The intensity connection point (0 = no pixelation, 1 = maximum). Defaults to 0.3 when unconnected.
     */
    public readonly intensity = this._registerOptionalInput(Uniforms.intensity, ConnectionPointType.Float, CreateStrongRef(0.3));

    /**
     * The shader program (vertex and fragment code) to use to render the block
     */
    public static override ShaderCode = BlockShaderProgram;

    /**
     * Instantiates a new PixelateBlock.
     * @param smartFilter - The smart filter this block belongs to
     * @param name - The friendly name of the block
     */
    constructor(smartFilter: SmartFilter, name: string) {
        super(smartFilter, name, false);
    }

    /**
     * Get the class instance that binds all the required data to the shader (effect) when rendering.
     * @returns The class instance that binds the data to the effect
     */
    public override getShaderBinding(): ShaderBinding {
        const input = this._confirmRuntimeDataSupplied(this.input);
        const intensity = this._confirmRuntimeDataSupplied(this.intensity);

        return new PixelateBlockShaderBinding(input, intensity);
    }
}
