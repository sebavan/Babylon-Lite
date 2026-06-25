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
 * Demo — "Hello Slug" (WebGL2 text). The smoke test / minimal reference for the lite-gl
 * Slug text renderer: load a font, shape one string into a `TextData`, wrap it in a
 * `TextLayer`, and draw it every frame with `renderText`.
 *
 * Mirrors the WebGPU `scene180` text demo but in the standalone lite-gl idiom (no scene /
 * camera — `renderText(tr)` is called directly from the render loop, like `renderSprites`).
 * The layer is re-centered each frame from the live drawing-buffer size so the glyphs stay
 * centered regardless of canvas resolution / device-pixel-ratio.
 *
 * Stamps `canvas.dataset.ready = "true"` after the first drawn frame (loader overlay + the
 * headless screenshot harness gate on it) and freezes after that first frame so a capture is
 * stable.
 */
const initStart = performance.now();
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = createGLEngine(canvas, { alpha: false });

const TEXT = "Hello Slug";
const FONT_SIZE_PX = 96;

let renderer: TextRenderer | null = null;
let layer: TextLayer | null = null;
let data: DefaultTextData | null = null;
let firstFrameDrawn = false;

async function init(): Promise<void> {
    const font = await loadFont("/fonts/Inter.ttf");
    data = createDefaultTextData(font, FONT_SIZE_PX, TEXT, [1, 1, 1, 1]);
    layer = createTextLayer(data, { positionPx: { x: 0, y: 0 }, scale: 1, opacity: 1 });
    renderer = createTextRenderer(engine, {
        layers: [layer],
        clear: true,
        clearValue: { r: 0.05, g: 0.06, b: 0.09, a: 1 },
    });
}

void init();

runRenderLoop(engine, () => {
    resizeGLEngine(engine);
    if (renderer === null || layer === null || data === null || !isTextRendererReady(renderer)) {
        return;
    }

    // Re-center each frame from the live drawing-buffer size. The layer origin maps glyph-local
    // (0,0) — the layout's baseline-left — to this pixel, so offset Y down by ~0.35·em to sit the
    // cap-height band around the vertical center.
    const w = engine.canvas.width;
    const h = engine.canvas.height;
    layer.positionPx.x = Math.round((w - data.width) / 2);
    layer.positionPx.y = Math.round(h / 2 + FONT_SIZE_PX * 0.35);

    const drawCalls = renderText(renderer);

    if (!firstFrameDrawn && drawCalls > 0) {
        firstFrameDrawn = true;
        canvas.dataset.drawCalls = String(drawCalls);
        canvas.dataset.initMs = String(performance.now() - initStart);
        canvas.dataset.ready = "true";
        // Deterministic single-frame capture: halt so the screenshot is stable.
        canvas.dataset.animationFrozen = "true";
        stopRenderLoop(engine);
    }
});
