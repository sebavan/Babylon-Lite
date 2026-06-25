import { type GLEngineContext, type GLTexture, getRenderHeight, getRenderWidth } from "babylon-lite-gl";
import { type OutputTextureOptions } from "../blockFoundation/textureOptions.js";
import { type SmartFilter } from "../smartFilter.js";
import { type TextureSize } from "../types.js";

/**
 * Determines the output texture size for a given shader block
 * @param smartFilter - The smart filter to use
 * @param engine - The engine to use
 * @param textureOptions - The texture options to use
 * @returns - The output texture size
 */
export function GetBlockOutputTextureSize(smartFilter: SmartFilter, engine: GLEngineContext, textureOptions: OutputTextureOptions): TextureSize {
    let outputWidth: number;
    let outputHeight: number;
    const renderTargetWrapper = smartFilter.outputBlock.renderTargetWrapper;
    if (renderTargetWrapper) {
        outputWidth = renderTargetWrapper.width;
        outputHeight = renderTargetWrapper.height;
    } else {
        outputWidth = getRenderWidth(engine);
        outputHeight = getRenderHeight(engine);
    }
    return {
        width: Math.floor(outputWidth * textureOptions.ratio),
        height: Math.floor(outputHeight * textureOptions.ratio),
    };
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

/**
 * Resolves once the supplied lite-gl texture has finished loading.
 *
 * Adaptation: Babylon used `texture.isReady()` + `getInternalTexture().onLoadedObservable`. In
 * `babylon-lite-gl`, {@link GLTexture.isReady} is a boolean PROPERTY that flips to `true` once the
 * underlying image has loaded asynchronously. We poll it (driven by the animation frame loop) and
 * resolve as soon as it is ready, or after `maxWaitMs` so a never-ready texture cannot deadlock the
 * runtime initialization.
 * @param _engine - The engine the texture belongs to (kept for signature fidelity; unused)
 * @param texture - The texture to wait on
 * @param maxWaitMs - The maximum time to wait before resolving anyway
 * @returns A promise that resolves when the texture is ready (or the max wait elapses)
 */
export function waitForTextureReady(_engine: GLEngineContext, texture: GLTexture, maxWaitMs = 10000): Promise<void> {
    return new Promise<void>((resolve) => {
        if (texture.isReady) {
            resolve();
            return;
        }

        const startTime = performance.now();

        const poll = (): void => {
            if (texture.isReady || performance.now() - startTime >= maxWaitMs) {
                resolve();
                return;
            }
            ScheduleNextPoll(poll);
        };

        ScheduleNextPoll(poll);
    });
}
