import { type GLEffect, type GLEngineContext, setEffectTexture } from "babylon-lite-gl";

import { ShaderBinding } from "../runtime/shaderRuntime.js";
import { ShaderBlock } from "../blockFoundation/shaderBlock.js";
import { ConnectionPointType } from "../connection/connectionPointType.js";
import { type RuntimeData } from "../connection/connectionPoint.js";
import { type ShaderProgram } from "../utils/shaderCodeUtils.js";
import { type SmartFilter } from "../smartFilter.js";

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
            uniform sampler2D _input_; // main`,
        mainInputTexture: "_input_",
        mainFunctionName: "_blackAndWhite_",
        functions: [
            {
                name: "_blackAndWhite_",
                code: `
                    vec4 _blackAndWhite_(vec2 vUV) {
                        vec4 color = texture2D(_input_, vUV);
                        // Rec. 601 luma coefficients
                        float luminance = dot(color.rgb, vec3(0.3, 0.59, 0.11));
                        return vec4(vec3(luminance), color.a);
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
};

/**
 * The shader binding for the BlackAndWhiteBlock, used by the runtime.
 */
class BlackAndWhiteBlockShaderBinding extends ShaderBinding {
    private readonly _input: RuntimeData<ConnectionPointType.Texture>;

    /**
     * Creates a new shader binding instance for the block.
     * @param input - The input texture runtime value
     */
    constructor(input: RuntimeData<ConnectionPointType.Texture>) {
        super();
        this._input = input;
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
    }
}

/**
 * A block that converts its input texture to grayscale using a luminance weighting.
 */
export class BlackAndWhiteBlock extends ShaderBlock {
    /**
     * The class name of the block.
     */
    public static override ClassName = "BlackAndWhiteBlock";

    /**
     * The namespace of the block.
     */
    public static override Namespace = "Babylon.Demo.Effects";

    /**
     * The input texture connection point.
     */
    public readonly input = this._registerInput(Uniforms.input, ConnectionPointType.Texture);

    /**
     * The shader program (vertex and fragment code) to use to render the block
     */
    public static override ShaderCode = BlockShaderProgram;

    /**
     * Instantiates a new BlackAndWhiteBlock.
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

        return new BlackAndWhiteBlockShaderBinding(input);
    }
}
