# smart-filters-gl

A port of the **Babylon.js SmartFilter runtime** (`@babylonjs/smart-filters`, which renders a graph of
GPU shader blocks via `@babylonjs/core`) onto the **`babylon-lite-gl`** WebGL2 micro-engine.

The SmartFilter graph architecture (blocks, connections, command buffer) is preserved; only the
**rendering backend** is swapped from `@babylonjs/core` to `babylon-lite-gl`. The result is a tiny,
tree-shakeable smart-filter runtime: a minimal one-effect filter app bundles to **~30 KB raw / ~10 KB
gzip** vs **~233 KB / ~60 KB** for the `@babylonjs/core`-based original (see [`benchmark/`](./benchmark/)).

> Proof-of-concept. Scope: the runtime + the minimal graph needed to build and render filters, plus two
> example blocks. Optimizer, serialization, aggregate/custom blocks and the editor layer are out of scope.

## Usage

```ts
import { createGLEngine, loadTexture2D } from "babylon-lite-gl";
import { SmartFilter, InputBlock, ConnectionPointType, PixelateBlock, BlackAndWhiteBlock } from "smart-filters-gl";

const engine = createGLEngine(canvas);

const sf = new SmartFilter("demo");
const source = new InputBlock(sf, "source", ConnectionPointType.Texture, loadTexture2D(engine, "image.jpg"));

// Chain blocks: source -> B&W -> Pixelate -> output
const bw = new BlackAndWhiteBlock(sf, "bw");
const pixelate = new PixelateBlock(sf, "pixelate");
source.output.connectTo(bw.input);
bw.output.connectTo(pixelate.input);
pixelate.output.connectTo(sf.output);

pixelate.intensity.runtimeData.value = 0.6; // live-tweakable each frame

const runtime = await sf.createRuntimeAsync(engine); // awaits shader compile + texture load
const frame = () => { runtime.render(); requestAnimationFrame(frame); };
requestAnimationFrame(frame);
```

Render to an offscreen target instead of the canvas by setting
`sf.outputBlock.renderTargetWrapper = createRenderTarget(engine, { width, height })` before
`createRuntimeAsync`. Call `runtime.dispose()` to tear down all effects + render targets.

## How the port maps to babylon-lite-gl

| Babylon.js core | babylon-lite-gl |
| --- | --- |
| `EffectRenderer` / `EffectWrapper` | `createEffectWrapper` / `applyEffectWrapper` / `drawEffect` / `setViewport` |
| `Effect` + `effect.setX(...)` | `GLEffect` + `setEffectFloat` / `setEffectTexture` / ... `(engine, effect, ...)` |
| `ThinEngine` / `AbstractEngine` | `GLEngineContext` (`createGLEngine`) |
| `RenderTargetWrapper` / `ThinRenderTargetTexture` | `GLRenderTarget` (`createRenderTarget`, `bindRenderTarget`) |
| `ThinTexture` | `GLTexture` |
| `Nullable`, `IColor*Like`, `TextureSize` | local plain types in [`src/types.ts`](./src/types.ts) |

### The shader shim (the crux)

SmartFilter blocks author GLSL **ES 1.0** (`texture2D`, `gl_FragColor`, `varying vUV`); Babylon's engine
auto-converts these. `babylon-lite-gl`'s `createEffect` expects raw GLSL **ES 3.00**, so
[`GetShaderCreateOptions`](./src/utils/shaderCodeUtils.ts) assembles ES 3.00: prepends `#version 300 es`
+ `precision`, exposes the varying as `in vec2 vUV`, declares `out vec4 glFragColor`, rewrites
`texture2D(`/`texture3D(` → `texture(`, and supplies a matching fullscreen-quad vertex shader.

### Notable runtime adaptation

`babylon-lite-gl` effects must be polled via `isEffectReady` to finalize uniform/sampler locations —
and this is **also how they recover after a WebGL context loss/restore** (which resets the effect to
not-ready with empty locations). `ShaderRuntime._draw` therefore re-checks `isEffectReady` every frame
before binding; without it, post-restore the `setEffect*` calls silently no-op and the shader renders
with stale/default uniforms.

## Demo

```bash
pnpm --filter smart-filters-gl demo        # bundle demo/demo.ts -> demo/dist/bundle.js
node packages/smart-filters-gl/demo/serve.mjs   # serve http://localhost:8777
```

An interactive page (procedural test image, live Pixelate-intensity slider, B&W→Pixelate toggle).

## Typecheck

```bash
npx tsc --noEmit -p packages/smart-filters-gl/tsconfig.json
```
