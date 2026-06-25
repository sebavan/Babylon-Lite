import { type GLEngineContext, type GLRenderTarget } from "babylon-lite-gl";
import { CommandBuffer } from "../command/commandBuffer.js";
import { type IDisposable } from "../IDisposable.js";
import { type Command } from "../command/command.js";
import { type ShaderBlock } from "../blockFoundation/shaderBlock.js";

/**
 * A runtime is a snapshot of a smart filter containing all the
 * required data to render it as well as the entire command buffer.
 */
export type SmartFilterRuntime = {
    /**
     * The command buffer containing all the commands to execute during a frame.
     */
    readonly commandBuffer: Readonly<CommandBuffer>;

    /**
     * Renders one frame of the smart filter.
     */
    render(): void;

    /**
     * Dispose the runtime and all its associated resources
     */
    dispose(): void;
};

/**
 * The internal runtime implementation exposing more information than @see SmartFilterRuntime.
 * This is used internally to render the smart filter.
 *
 * It is not fully exposed publicly to prevent any misuse of the runtime.
 */
export class InternalSmartFilterRuntime implements SmartFilterRuntime {
    /**
     * The engine used by the smart filter.
     *
     * Adaptation: this is a `babylon-lite-gl` {@link GLEngineContext} instead of Babylon's `ThinEngine`.
     * Babylon's `EffectRenderer` has no lite-gl equivalent (the "effect renderer" in lite-gl is a set of
     * free functions that operate on the engine), so it is dropped and the engine is passed where needed.
     */
    public readonly engine: GLEngineContext;

    /**
     * The command buffer containing all the commands to execute during a frame.
     */
    public readonly commandBuffer: CommandBuffer;

    private readonly _resources: IDisposable[];

    /**
     * Maps each non-final ShaderBlock to the render target it draws into. The block exposes
     * `renderTarget.texture` (a `GLTexture`) to downstream samplers, while its render command draws
     * INTO this `GLRenderTarget`. Populated by the {@link RenderTargetGenerator}.
     */
    private readonly _blockRenderTargets: Map<ShaderBlock, GLRenderTarget>;

    /**
     * Instantiates a new smart filter runtime for one given engine.
     * @param engine - the engine to use to render the smart filter
     */
    constructor(engine: GLEngineContext) {
        this.engine = engine;

        this._resources = [];

        this.commandBuffer = new CommandBuffer();

        this._blockRenderTargets = new Map<ShaderBlock, GLRenderTarget>();
    }

    /**
     * Register a resource to be disposed when the runtime is disposed.
     * @param resource - defines the resource to dispose once the runtime is disposed
     */
    public registerResource(resource: IDisposable): void {
        this._resources.push(resource);
    }

    /**
     * Registers a command to be executed during the render loop.
     * @param command - defines the command to execute
     */
    public registerCommand(command: Command): void {
        this.commandBuffer.push(command);
    }

    /**
     * Associates a render target with a shader block so that the block's render command can draw into it.
     * @param block - the shader block that owns the render target
     * @param renderTarget - the render target the block draws into
     */
    public setBlockRenderTarget(block: ShaderBlock, renderTarget: GLRenderTarget): void {
        this._blockRenderTargets.set(block, renderTarget);
    }

    /**
     * Retrieves the render target a shader block draws into, if one was assigned.
     * @param block - the shader block to look up
     * @returns the render target the block draws into, or null if none was assigned (e.g. the final block)
     */
    public getBlockRenderTarget(block: ShaderBlock): GLRenderTarget | null {
        return this._blockRenderTargets.get(block) ?? null;
    }

    /**
     * Renders the smart filter.
     * This function will execute all the commands contained in the command buffer.
     */
    public render(): void {
        try {
            // Adaptation: lite-gl manages its own depth/stencil state, so the Babylon save/restore
            // around the command buffer execution is dropped.
            this.commandBuffer.execute();
        } catch (e) {
            // Fail loud but do not kill the render loop: a single bad frame should not be fatal.
            // eslint-disable-next-line no-console
            console.error("SmartFilter render failed:", e);
        }
    }

    /**
     * Dispose the runtime and all its associated resources
     */
    public dispose(): void {
        for (const resource of this._resources) {
            resource.dispose();
        }
        this._blockRenderTargets.clear();
    }
}
