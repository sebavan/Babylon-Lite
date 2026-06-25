// @babylonjs/lite-gl/text — the Slug text renderer (CPU/data layer + WebGL2 GPU layer).
//
// Phase 1 ported the GPU-agnostic CPU/data layer (font loading, default LTR layout,
// glyph-curve extraction, glyph storage + atlas staging, and the per-instance text
// data / slot allocator) from the WebGPU `@babylonjs/lite` package. Phase 2 adds the
// WebGL2 GPU layer: the rgba32f curve/band atlas float-textures + the per-block
// instance buffer (uploaded lazily off `SharedAtlas` / `TextData`), the GLSL ES 3.00
// translation of the two Slug shaders, and the standalone `TextRenderer` draw.
//
// Convention (mirrors `src/index.ts`): the public API is re-exported EXPLICITLY by
// name — never `export *`. This keeps the public surface intentional and reviewable
// and lets `export type` mark type-only re-exports (required under `isolatedModules`).
// The module has no top-level side effects (`sideEffects: false`), so a consumer that
// imports nothing from it tree-shakes the whole text path — including `text-shaper` —
// away.

// ─── Fonts ───────────────────────────────────────────────────────────
export type { Font } from "./text/font.js";
export { loadFont, createFontFromBuffer } from "./text/font.js";

// ─── Glyph-outline extraction (default `text-shaper`-backed) ─────────
export { extractGlyphCurves, cubicToQuadratics } from "./text/glyph-extraction.js";

// ─── Layout options ──────────────────────────────────────────────────
export type { TextLayoutOptions } from "./text/layout.js";

// ─── Glyph storage + atlas staging ───────────────────────────────────
export type { GlyphStorage, CurveSetId, QuadCurve, GlyphBounds, GlyphCurves } from "./text/glyph-storage.js";
export { createGlyphStorage, updateGlyphStorage, disposeGlyphStorage } from "./text/glyph-storage.js";

// ─── Per-block text data (instances + slot allocator) ────────────────
export type { TextData, PlacedGlyph, GlyphRun, TextDataUpdate } from "./text/text-data.js";
export { createTextData, updateTextData, disposeTextData } from "./text/text-data.js";

// ─── Default convenience text data (shapes + extracts in one call) ───
export type { DefaultTextData } from "./text/default-text-data.js";
export { createDefaultTextData, updateDefaultTextData, disposeDefaultTextData } from "./text/default-text-data.js";

// ─── Renderer (WebGL2 GPU layer: float-texture atlas + instanced Slug draw) ──
export type { TextLayer, TextLayerOptions, TextRenderer, TextRendererOptions } from "./text/text-renderer.js";
export {
    createTextLayer,
    setTextLayerPosition,
    createTextRenderer,
    renderText,
    isTextRendererReady,
    addTextRendererLayer,
    removeTextRendererLayer,
    registerTextRenderer,
    unregisterTextRenderer,
    disposeTextRenderer,
} from "./text/text-renderer.js";
