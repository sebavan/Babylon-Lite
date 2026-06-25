// SIZE BASELINE — the CURRENT @babylonjs/smart-filters + @babylonjs/core runtime.
// Identical graph to lite-entry.ts (InputBlock(texture) -> PixelateBlock -> output,
// createRuntimeAsync + render) so the only difference measured is the engine backend.
//
// Requires the published packages (NOT part of this pnpm workspace). Measure it from
// an isolated install — see README.md.
import { ThinEngine } from "@babylonjs/core/Engines/thinEngine.js";
import { ThinTexture } from "@babylonjs/core/Materials/Textures/thinTexture.js";
import type { Effect } from "@babylonjs/core/Materials/effect.js";
import { SmartFilter, InputBlock, ShaderBlock, ShaderBinding, ConnectionPointType, CreateStrongRef, type RuntimeData, type ShaderProgram } from "@babylonjs/smart-filters";

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
                        float gridSize = mix(256.0, 8.0, clamp(_intensity_, 0.0, 1.0));
                        vec2 snapped = (floor(vUV * gridSize) + 0.5) / gridSize;
                        return texture2D(_input_, snapped);
                    }
                `,
            },
        ],
    },
};

const Uniforms = { input: "input", intensity: "intensity" };

class PixelateBinding extends ShaderBinding {
    private readonly _input: RuntimeData<ConnectionPointType.Texture>;
    private readonly _intensity: RuntimeData<ConnectionPointType.Float>;
    constructor(input: RuntimeData<ConnectionPointType.Texture>, intensity: RuntimeData<ConnectionPointType.Float>) {
        super();
        this._input = input;
        this._intensity = intensity;
    }
    public override bind(effect: Effect): void {
        effect.setTexture(this.getRemappedName(Uniforms.input), this._input.value);
        effect.setFloat(this.getRemappedName(Uniforms.intensity), this._intensity.value);
    }
}

class PixelateBlock extends ShaderBlock {
    public static override ClassName = "PixelateBlock";
    public static override Namespace = "Babylon.Demo.Effects";
    public readonly input = this._registerInput(Uniforms.input, ConnectionPointType.Texture);
    public readonly intensity = this._registerOptionalInput("intensity", ConnectionPointType.Float, CreateStrongRef(0.3));
    public static override ShaderCode = BlockShaderProgram;
    constructor(smartFilter: SmartFilter, name: string) {
        super(smartFilter, name, false);
    }
    public getShaderBinding(): ShaderBinding {
        return new PixelateBinding(this._confirmRuntimeDataSupplied(this.input), this._confirmRuntimeDataSupplied(this.intensity));
    }
}

async function main(): Promise<void> {
    const canvas = document.createElement("canvas");
    const engine = new ThinEngine(canvas, false);

    const smartFilter = new SmartFilter("pixelate-demo");
    const texture = new ThinTexture(engine.createTexture("image.jpg", false, false, null));

    const input = new InputBlock(smartFilter, "input", ConnectionPointType.Texture, texture);
    const pixelate = new PixelateBlock(smartFilter, "pixelate");

    input.output.connectTo(pixelate.input);
    pixelate.output.connectTo(smartFilter.output);

    const runtime = await smartFilter.createRuntimeAsync(engine);
    runtime.render();
}

void main();
