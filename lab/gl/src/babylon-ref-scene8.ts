// GL lab Scene 8 — Babylon.js parity REFERENCE.
//
// Renders the exact same Lottie animation as scene8.ts, but through the
// (vendored) Babylon.js `lottiePlayer` running on @babylonjs/core's ThinEngine —
// the engine @babylonjs/lite-gl replaces. The parity harness freezes both this
// page and the lite scene at `?seekTime` and pixel-diffs them.
//
// The vendored player lives in `_bjs-lottie/` (a verbatim, @ts-nocheck copy of
// Babylon.js/packages/dev/lottiePlayer/src with `core/*` repointed to
// `@babylonjs/core/*`); it is a parity baseline only, not maintained here.
import { LocalPlayer } from "./_bjs-lottie/localPlayer";
import { AnimationController } from "./_bjs-lottie/rendering/animationController";
import { GetRawAnimationDataAsync } from "./_bjs-lottie/parsing/rawAnimation";
import { CalculateScaleFactors } from "./_bjs-lottie/rendering/calculateScaleFactor";

const ANIMATION_URL = "/lottie/demo.json";
const container = document.getElementById("lottie-container") as HTMLDivElement;

function parseSeekTime(): number | null {
    const raw = new URLSearchParams(window.location.search).get("seekTime");
    if (raw === null) {
        return null;
    }
    const seconds = Number.parseFloat(raw);
    return Number.isFinite(seconds) ? seconds : null;
}

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
