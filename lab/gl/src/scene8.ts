// GL lab Scene 8 — a Lottie animation played on @babylonjs/lite-gl via
// @babylonjs/lite-lottie (zero @babylonjs/core).
//
// Live (default): the main-thread `LocalPlayer` loops the animation.
// Frozen (`?seekTime=<s>`): renders EXACTLY the frame at that time via
// `AnimationController.renderFrame`, then stamps `dataset.animationFrozen` — the
// deterministic single-frame capture the parity harness compares against the
// Babylon.js reference (lab/gl/babylon-ref-scene8.ts), mirroring the
// `?seekTime` freeze convention of the fullscreen scenes.
import { AnimationController, CalculateScaleFactors, GetRawAnimationDataAsync, LocalPlayer } from "babylon-lite-lottie";

const ANIMATION_URL = "/lottie/demo.json";
const container = document.getElementById("lottie-container") as HTMLDivElement;

/** Parse the parity harness's `?seekTime=<seconds>` freeze parameter. */
function parseSeekTime(): number | null {
    const raw = new URLSearchParams(window.location.search).get("seekTime");
    if (raw === null) {
        return null;
    }
    const seconds = Number.parseFloat(raw);
    return Number.isFinite(seconds) ? seconds : null;
}

/** Stamp the readiness metadata the lab loader + perf/parity harnesses read. */
function stampReady(canvas: HTMLCanvasElement): void {
    if (canvas.dataset.ready === "true") {
        return;
    }
    canvas.dataset.drawCalls = "1";
    canvas.dataset.initMs = String(performance.now() - initStart);
    canvas.dataset.ready = "true";
}

const initStart = performance.now();
const seekTime = parseSeekTime();

if (seekTime === null) {
    // Live, looping demo — the main-thread LocalPlayer path.
    const player = new LocalPlayer();
    void player.playAnimationAsync({
        container,
        animationSource: ANIMATION_URL,
        variables: null,
        configuration: { loopAnimation: true },
        onFirstRender: () => {
            const canvas = document.getElementById("babylon-canvas") as HTMLCanvasElement | null;
            if (canvas !== null) {
                stampReady(canvas);
            }
        },
    });
} else {
    // Deterministic frozen frame for parity (matches the BJS reference exactly).
    void renderFrozenFrame(seekTime);
}

async function renderFrozenFrame(seek: number): Promise<void> {
    const raw = await GetRawAnimationDataAsync(ANIMATION_URL);

    const canvas = document.createElement("canvas");
    canvas.id = "babylon-canvas";
    const scale = CalculateScaleFactors(raw.w, raw.h, container);
    canvas.style.width = `${raw.w * scale.canvasScale}px`;
    canvas.style.height = `${raw.h * scale.canvasScale}px`;
    container.appendChild(canvas);

    const controller = await AnimationController.CreateAsync(canvas, raw, scale.canvasScale, scale.atlasScale, new Map<string, string>(), {});
    const frame = Math.round(seek * raw.fr);

    // The sprite shaders compile asynchronously, so render the target frame each
    // tick through a short warmup, then issue one final stable frame and freeze.
    // Stopping the loop leaves that frame on the (preserveDrawingBuffer:false) canvas.
    const warmupMs = 600;
    const start = performance.now();
    const tick = (): void => {
        controller.renderFrame(frame);
        stampReady(canvas);
        if (controller.hasRendered && performance.now() - start > warmupMs) {
            controller.renderFrame(frame);
            canvas.dataset.animationFrozen = "true";
            return;
        }
        requestAnimationFrame(tick);
    };
    tick();
}
