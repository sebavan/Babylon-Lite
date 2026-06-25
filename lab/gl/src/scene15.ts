import { createGLEngine, resizeGLEngine, runRenderLoop, stopRenderLoop } from "babylon-lite-gl";
import {
    loadFont,
    createDefaultTextData,
    createTextLayer,
    createTextRenderer,
    renderText,
    isTextRendererReady,
    type DefaultTextData,
    type TextRenderer,
    type TextLayer,
} from "babylon-lite-gl/text";

/**
 * Scene 15 — Text (Slug).
 *
 * Renders a fixed multi-line string with the @babylonjs/lite-gl Slug text renderer
 * (`@babylonjs/lite-gl/text`): load the font, shape it into a `DefaultTextData`, wrap that
 * in a `TextLayer`, and draw it with `renderText`. The Babylon.js reference
 * (lab/gl/src/babylon-ref-scene15.ts) renders the IDENTICAL text with the WebGPU
 * `babylon-lite` Slug text renderer — both packages share the same font, the same Slug
 * coverage algorithm, and the same public API shape, so the two are directly
 * pixel-comparable. Residual diff is only the sub-pixel `fwidth` antialiasing across the
 * two GPU backends.
 *
 * Determinism (the whole point of the parity scene): every input that feeds the shared CPU
 * layout + GPU coverage is FROZEN and identical on both sides — same font file, same exact
 * string (mind the newline), same `FONT_SIZE_PX`, same default layout options, same fixed
 * pixel position, same white text color, same clear color. The layer's affine MVP maps a
 * glyph-local point to screen pixel `(scale·x + posX, posY − scale·y)` independent of the
 * canvas size, so a FIXED `positionPx` lands the glyphs on the exact same pixels regardless
 * of drawing-buffer dimensions — no per-frame re-centering (that would couple placement to
 * canvas size and add noise).
 *
 * Freeze: `?seekTime=<seconds>` gates the single render. The text is static, so the seek
 * value only marks when to draw the one frame, stamp `dataset.ready` then
 * `dataset.animationFrozen`, and halt — giving the harness a stable capture.
 */

const TEXT = "Hello Slug\nWebGL2 text";
const FONT_SIZE_PX = 48;
const POSITION_PX = { x: 480, y: 340 };
const TEXT_COLOR: readonly [number, number, number, number] = [1, 1, 1, 1];
const CLEAR_COLOR = { r: 0.05, g: 0.06, b: 0.09, a: 1 };

/** Parse the parity harness's `?seekTime=<seconds>` query param (null when absent). */
function parseSeekTime(): number | null {
    const raw = new URLSearchParams(window.location.search).get("seekTime");
    if (raw === null) {
        return null;
    }
    const seconds = Number.parseFloat(raw);
    return Number.isFinite(seconds) ? seconds : null;
}

const initStart = performance.now();
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = createGLEngine(canvas, { alpha: false });

let renderer: TextRenderer | null = null;
let firstFrameDrawn = false;

async function init(): Promise<void> {
    const font = await loadFont("/fonts/Inter.ttf");
    const data: DefaultTextData = createDefaultTextData(font, FONT_SIZE_PX, TEXT, TEXT_COLOR);
    const layer: TextLayer = createTextLayer(data, { positionPx: POSITION_PX, scale: 1, rotationRad: 0, opacity: 1 });
    renderer = createTextRenderer(engine, { layers: [layer], clear: true, clearValue: CLEAR_COLOR });
}

void init();

const seekTime = parseSeekTime();

runRenderLoop(engine, () => {
    resizeGLEngine(engine);
    if (renderer === null || !isTextRendererReady(renderer)) {
        return;
    }

    const drawCalls = renderText(renderer);

    if (!firstFrameDrawn && drawCalls > 0) {
        firstFrameDrawn = true;
        canvas.dataset.drawCalls = String(drawCalls);
        canvas.dataset.initMs = String(performance.now() - initStart);
        canvas.dataset.ready = "true";
        // Text is static, so the one drawn frame is the whole capture: when the harness pins a
        // ?seekTime, freeze + halt for a stable screenshot (mirrors scene8's freeze convention).
        if (seekTime !== null) {
            canvas.dataset.animationFrozen = "true";
            stopRenderLoop(engine);
        }
    }
});
