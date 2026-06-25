import {
    type GLEffect,
    type GLEffectWrapper,
    type GLEngineContext,
    type GLRenderTarget,
    applyEffectWrapper,
    bindRenderTarget,
    createEffectWrapper,
    disposeEffectWrapper,
    drawEffect,
    getRenderHeight,
    getRenderWidth,
    isEffectReady,
    setEffectInt,
    setViewport,
} from "babylon-lite-gl";

import { type IDisposable } from "../IDisposable.js";
import { type ShaderProgram, DecorateSymbol, DisableUniform, GetShaderCreateOptions } from "../utils/shaderCodeUtils.js";
import { CreateStrongRef, type StrongRef } from "../utils/strongRef.js";
import { type ConnectionPoint } from "../connection/connectionPoint.js";
import { type ConnectionPointType } from "../connection/connectionPointType.js";
import { type OutputBlock } from "../blockFoundation/outputBlock.js";

/**
 * Minimal contract describing a block that can be disabled.
 *
 * Adaptation: Babylon imported `IDisableableBlock` from `disableableShaderBlock.ts`, which is dropped
 * in this port. We re-declare the structural contract here so {@link DisableableShaderBinding} keeps
 * compiling without pulling in the editor-heavy disableable block hierarchy.
 */
export interface IDisableableBlock {
    /**
     * The connection point controlling whether the block is disabled.
     */
    readonly disabled: ConnectionPoint<ConnectionPointType.Boolean>;
}

/**
 * The shader bindings for a ShaderBlock that can't be disabled.
 */
export abstract class ShaderBinding {
    /**
     * Binds all the required data to the shader when rendering.
     * Overridden by derived classes.
     * @param engine - defines the engine to bind the data on
     * @param effect - defines the effect to bind the data to
     * @param width - defines the width of the output
     * @param height - defines the height of the output
     */
    public abstract bind(engine: GLEngineContext, effect: GLEffect, width?: number, height?: number): void;

    private _remappedShaderVariables: { [key: string]: string } = {};

    /**
     * Gets the remapped shader variable name.
     * @param variableName - The variable name
     * @returns The remapped variable name
     */
    public getRemappedName(variableName: string): string {
        variableName = DecorateSymbol(variableName);
        return this._remappedShaderVariables[variableName] ?? variableName;
    }

    /**
     * Sets the remapped shader variables.
     * @param variableName - defines the variable name to remap
     * @param remappedName - defines the remapped name
     */
    public addShaderVariableRemapping(variableName: string, remappedName: string): void {
        this._remappedShaderVariables[variableName] = remappedName;
    }
}

/**
 * The shader bindings for a disableable ShaderBlock.
 */
export abstract class DisableableShaderBinding extends ShaderBinding {
    private _disabled: StrongRef<boolean>;

    /**
     * Construct a ShaderBinding instance.
     * @param parentBlock - The parent block
     */
    constructor(parentBlock: IDisableableBlock) {
        super();
        this._disabled = parentBlock.disabled?.runtimeData || CreateStrongRef(false);
    }

    /**
     * Binds all the required data to the shader when rendering.
     *
     * Adaptation: Babylon used `effect.setBool(...)`. lite-gl has no boolean setter; a GLSL `bool`
     * uniform is set with `uniform1i`, so we use {@link setEffectInt} with 0/1.
     * @param engine - defines the engine to bind the data on
     * @param effect - defines the effect to bind the data to
     * @param _width - defines the width of the output
     * @param _height - defines the height of the output
     */
    public bind(engine: GLEngineContext, effect: GLEffect, _width?: number, _height?: number): void {
        setEffectInt(engine, effect, this.getRemappedName(DisableUniform), this._disabled.value ? 1 : 0);
    }
}

/**
 * The shader runtime is the base for any runtime associated with a @see ShaderBlock.
 *
 * It encapsulates the basic needs to render a full screen effect mainly the effect wrapper holding on the shader program.
 *
 * It is able to either render to a texture or directly to the main canvas.
 *
 * It also manages the disposal of the effect wrapper.
 */
export class ShaderRuntime implements IDisposable {
    /**
     * Promise that resolves when the effect is ready to be used.
     */
    public readonly onReadyAsync: Promise<void>;

    private readonly _engine: GLEngineContext;
    private readonly _wrapper: GLEffectWrapper;
    private readonly _shaderBinding: ShaderBinding;
    private _disposed = false;

    /**
     * Creates a new @see ShaderRuntime.
     *
     * Adaptation: Babylon took an `EffectRenderer` (which carried the engine). lite-gl has no
     * EffectRenderer object - the engine is passed directly and the "effect renderer" is a set of
     * free functions operating on it.
     * @param engine - defines the engine to use to render the full screen effect
     * @param shaderProgram - defines the shader code associated with this runtime
     * @param shaderBinding - defines the shader bindings associated with this runtime
     */
    constructor(engine: GLEngineContext, shaderProgram: ShaderProgram, shaderBinding: ShaderBinding) {
        this._engine = engine;
        this._shaderBinding = shaderBinding;
        this._wrapper = createEffectWrapper(engine, GetShaderCreateOptions(shaderProgram));

        // Wraps the effect readiness in a promise to expose it as a public property.
        //
        // Adaptation: lite-gl does not auto-finalize effects; finalization (link + uniform/sampler
        // resolution) only happens when something polls `isEffectReady`. So we drive our own poll
        // loop here (rather than relying on `executeWhenCompiled`, which would never fire on its own).
        this.onReadyAsync = new Promise<void>((resolve, reject) => {
            const effect = this._wrapper.effect;

            const poll = (): void => {
                // If the runtime was disposed before the effect became ready, resolve quietly so we do
                // not leak a pending promise or keep polling a disposed effect.
                if (this._disposed) {
                    resolve();
                    return;
                }

                if (isEffectReady(this._engine, effect)) {
                    resolve();
                    return;
                }

                if (effect._compileError !== null) {
                    reject(new Error(`SmartFilter effect "${effect.name}" failed to compile: ${effect._compileError}`));
                    return;
                }

                ScheduleNextPoll(poll);
            };

            poll();
        });
    }

    /**
     * Renders the full screen effect into a render target.
     * @param outputBlock - The output block to render to - assumes it has a .renderTargetWrapper
     */
    public renderToTargetWrapper(outputBlock: OutputBlock): void {
        const renderTarget = outputBlock.renderTargetWrapper;
        if (renderTarget) {
            bindRenderTarget(this._engine, renderTarget);
            this._draw(renderTarget.width, renderTarget.height);
        }
    }

    /**
     * Renders the full screen effect into a render target.
     *
     * Adaptation: Babylon took a `ThinRenderTargetTexture`; in this port the render destination is a
     * `babylon-lite-gl` {@link GLRenderTarget} (whose `.texture` is what downstream samplers consume).
     * @param renderTarget - The render target to render into
     */
    public renderToTargetTexture(renderTarget: GLRenderTarget): void {
        bindRenderTarget(this._engine, renderTarget);
        this._draw(renderTarget.width, renderTarget.height);
    }

    /**
     * Renders the full screen effect into the main canvas.
     */
    public renderToCanvas(): void {
        bindRenderTarget(this._engine, null);
        setViewport(this._engine);
        this._draw(getRenderWidth(this._engine), getRenderHeight(this._engine));
    }

    /**
     * "Draws" the full screen effect into the currently bound output.
     * @param width - defines the width of the output
     * @param height - defines the height of the output
     */
    private _draw(width: number, height: number): void {
        // Re-validate readiness every frame. lite-gl effects must be polled via isEffectReady to
        // finalize uniform/sampler locations; this ALSO re-finalizes after a WebGL context
        // loss/restore (which resets the effect to not-ready with empty locations). Without this,
        // post-restore the setEffect* calls silently no-op (stale/default uniforms).
        if (!isEffectReady(this._engine, this._wrapper.effect)) {
            return;
        }
        applyEffectWrapper(this._wrapper);
        this._shaderBinding.bind(this._engine, this._wrapper.effect, width, height);
        drawEffect(this._engine);
    }

    /**
     * Disposes the runtime resources.
     */
    public dispose(): void {
        this._disposed = true;
        disposeEffectWrapper(this._wrapper);
    }
}

/**
 * Schedules a callback for the next animation frame, falling back to a timer when
 * `requestAnimationFrame` is not available (e.g. non-DOM environments).
 * @param callback - The callback to invoke on the next frame
 */
function ScheduleNextPoll(callback: () => void): void {
    if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(callback);
    } else {
        setTimeout(callback, 16);
    }
}
