import { type GLRenderTarget, createRenderTarget, disposeRenderTarget } from "babylon-lite-gl";

import { type BaseBlock } from "../blockFoundation/baseBlock.js";
import { type InitializationData, type SmartFilter } from "../smartFilter.js";
import { type InternalSmartFilterRuntime } from "./smartFilterRuntime.js";
import { ShaderBlock } from "../blockFoundation/shaderBlock.js";
import { CreateStrongRef } from "../utils/strongRef.js";
import { type ConnectionPointType, type ConnectionPointValue } from "../connection/connectionPointType.js";
import { type OutputTextureOptions } from "../blockFoundation/textureOptions.js";
import { GetBlockOutputTextureSize } from "../utils/textureUtils.js";

/**
 * The render target generator is responsible for creating and assigning render targets to ShaderBlocks.
 *
 * Adaptation: Babylon pooled `ThinRenderTargetTexture`s with a refcount optimizer. For this POC we
 * implement only the correct, non-optimized path: every non-final ShaderBlock gets its own
 * `babylon-lite-gl` {@link GLRenderTarget}. The block renders INTO that render target, while its
 * `.texture` (a `GLTexture`) is what downstream samplers consume. The render target itself is stashed
 * on the runtime (see {@link InternalSmartFilterRuntime.setBlockRenderTarget}) so the block's render
 * command can retrieve it.
 */
export class RenderTargetGenerator {
    private _optimize: boolean;
    private _numTargetsCreated: number;

    /**
     * Creates a new render target generator.
     * @param optimize - Retained for API compatibility with the Babylon original. Only the
     * non-optimized (always-create-a-new-target) path is implemented in this POC.
     */
    constructor(optimize = false) {
        this._optimize = optimize;
        this._numTargetsCreated = 0;
    }

    /**
     * Returns the number of render targets created by the process
     */
    public get numTargetsCreated(): number {
        return this._numTargetsCreated;
    }

    /**
     * Whether render-target optimization (pooling) was requested. Always reports the constructor value;
     * pooling itself is not implemented in this POC.
     */
    public get optimize(): boolean {
        return this._optimize;
    }

    /**
     * Sets the output textures for the ShaderBlocks of the smart filter.
     * @param smartFilter - The smart filter to generate the render targets for.
     * @param initializationData - The initialization data to use.
     */
    public setOutputTextures(smartFilter: SmartFilter, initializationData: InitializationData): void {
        smartFilter.output.ownerBlock.visit(initializationData, (block: BaseBlock, initializationData: InitializationData) => {
            if (!(block instanceof ShaderBlock)) {
                return;
            }

            // We assign a render target to the output of the block only if this is not the last block in
            // the chain, i.e. not the block connected to the smart output block (in which case the output
            // of the block goes to the canvas / output render target and not an intermediate texture).
            if (!block.output.endpoints.some((cp) => cp.ownerBlock === smartFilter.output.ownerBlock)) {
                const renderTarget = this._createRenderTarget(initializationData.runtime, smartFilter, block.outputTextureOptions);

                // Stash the render target so the block's render command can draw INTO it...
                initializationData.runtime.setBlockRenderTarget(block, renderTarget);

                // ...while exposing its `.texture` (a GLTexture) to downstream samplers.
                const outputTexture = renderTarget.texture;
                if (!block.output.runtimeData) {
                    block.output.runtimeData = CreateStrongRef<ConnectionPointValue<ConnectionPointType.Texture>>(outputTexture);
                } else {
                    block.output.runtimeData.value = outputTexture;
                }
            }
        });
    }

    /**
     * Creates an offscreen render target to hold the result of the block rendering.
     * @param runtime - The current runtime we create the render target for
     * @param smartFilter - The smart filter the render target is created for
     * @param textureOptions - The options to use to size the render target
     * @returns The render target
     */
    private _createRenderTarget(runtime: InternalSmartFilterRuntime, smartFilter: SmartFilter, textureOptions: OutputTextureOptions): GLRenderTarget {
        const engine = runtime.engine;

        // Get the smartFilter output size - either from the output block's render target or the engine's render size.
        const size = GetBlockOutputTextureSize(smartFilter, engine, textureOptions);

        const renderTarget = createRenderTarget(engine, { width: size.width, height: size.height });
        runtime.registerResource({
            dispose: () => {
                disposeRenderTarget(engine, renderTarget);
            },
        });
        this._numTargetsCreated++;

        return renderTarget;
    }
}
