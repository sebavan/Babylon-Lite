import { createEngine, startEngine, loadFont, createDefaultTextData, createTextLayer, createTextRenderer, registerTextRenderer } from "babylon-lite";

/**
 * Babylon.js (WebGPU `babylon-lite`) reference for GL Scene 15 — Text (Slug).
 *
 * This is the migration SOURCE the @babylonjs/lite-gl text renderer (lab/gl/src/scene15.ts)
 * was ported from. It renders the IDENTICAL text with the WebGPU `babylon-lite` Slug text
 * renderer so the parity harness can diff the two pixel-for-pixel. Both packages share the
 * same font, the same CPU layout, and the same Slug coverage shader (only the GPU backend —
 * WGSL/WebGPU here vs GLSL ES 3.00/WebGL2 there — differs), so a correct port is identical up
 * to sub-pixel `fwidth` antialiasing.
 *
 * Determinism: every input is FROZEN and byte-identical to scene15.ts — same `/fonts/Inter.ttf`,
 * same exact string (mind the newline), same `FONT_SIZE_PX`, same default layout options, same
 * fixed `POSITION_PX`, same white `TEXT_COLOR`, same clear color. The shared affine MVP maps a
 * glyph-local point to screen pixel `(scale·x + posX, posY − scale·y)` independent of the canvas
 * size, so the fixed position lands the glyphs on the same pixels on either backend.
 *
 * Freeze: the text is static, so a single rendered frame is the whole capture. After
 * `startEngine` resolves (first frame presented) we stamp `dataset.ready` then
 * `dataset.animationFrozen`; the render loop keeps re-presenting the identical static frame, so
 * any later screenshot is stable. `?seekTime` is accepted for harness-URL symmetry; it has no
 * effect on static text.
 */

const TEXT = "Hello Slug\nWebGL2 text";
const FONT_SIZE_PX = 48;
const POSITION_PX = { x: 480, y: 340 };
const TEXT_COLOR: readonly [number, number, number, number] = [1, 1, 1, 1];
const CLEAR_VALUE = { r: 0.05, g: 0.06, b: 0.09, a: 1 };

async function run(): Promise<void> {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const engine = await createEngine(canvas);
    const font = await loadFont("/fonts/Inter.ttf");

    const data = createDefaultTextData(font, FONT_SIZE_PX, TEXT, TEXT_COLOR);
    const layer = createTextLayer(data, { positionPx: POSITION_PX, scale: 1, rotationRad: 0, opacity: 1 });

    const tr = createTextRenderer(engine, { layers: [layer], clearValue: CLEAR_VALUE });
    registerTextRenderer(tr);

    await startEngine(engine);
    canvas.dataset.ready = "true";
    canvas.dataset.animationFrozen = "true";
}

void run();
