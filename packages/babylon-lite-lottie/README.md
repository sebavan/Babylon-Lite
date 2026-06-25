# @babylonjs/lite-lottie

A tiny, **tree-shakeable Lottie player** that renders on
[`@babylonjs/lite-gl`](https://github.com/BabylonJS/Babylon-Lite/tree/main/packages/babylon-lite-gl)
(WebGL2) — the lite counterpart of Babylon.js'
[`lottiePlayer`](https://github.com/BabylonJS/Babylon.js/tree/master/packages/dev/lottiePlayer),
with **no `@babylonjs/core` dependency**.

It parses a Lottie `.json`, rasterises each layer into a dynamic-texture sprite
atlas, and animates the sprites every frame through lite-gl's sprite renderer.
The renderer-agnostic parsing / scene-graph / maths / feature modules are shared
verbatim with Babylon's player; only the rendering backend is swapped, so output
matches the Babylon path. Heavy features (shapes, text, gradients) are loaded on
demand via dynamic `import()`, so an animation only ships the code it uses.

> **WebGL2 only**, via `@babylonjs/lite-gl` (a peer dependency).

## Install

```bash
npm install @babylonjs/lite-lottie @babylonjs/lite-gl
```

## Quick start — play on the main thread

```ts
import { LocalPlayer } from "@babylonjs/lite-lottie";

const player = new LocalPlayer();

await player.playAnimationAsync({
    // The player creates a <canvas> sized to the animation inside this element.
    container: document.getElementById("animation") as HTMLDivElement,
    // A URL to a Lottie .json, or an already-parsed RawLottieAnimation object.
    animationSource: "/animation.json",
    variables: null,
    configuration: { loopAnimation: true },
});

// later…
player.dispose();
```

## Entry points

| Import | Provides |
| --- | --- |
| `@babylonjs/lite-lottie` | Everything: the worker-backed `Player` (+ `CreatePlayer` / `PreWarmPlayerAsync` / `PlayAnimationAsync` / `DisposePlayer`) and the main-thread `LocalPlayer` (+ `CreateLocalPlayer` / `PlayLocalAnimationAsync` / `DisposeLocalPlayer`), plus the `AnimationConfiguration`, `AnimationInput` and `RawLottieAnimation` types. |
| `@babylonjs/lite-lottie/local` | Just the main-thread `LocalPlayer` path — no web-worker code. Smallest bundle for apps that don't need the off-thread renderer. |
| `@babylonjs/lite-lottie/worker` | The worker entry module, referenced internally by `Player` via `new Worker(new URL("…", import.meta.url))`. |

### Player vs LocalPlayer

- **`Player`** transfers an `OffscreenCanvas` to a web worker and renders the
  animation off the main thread (preferred when `OffscreenCanvas` + workers are
  available). Use `PreWarmPlayerAsync` to spin the worker up ahead of time.
- **`LocalPlayer`** renders on the main thread — simpler, and the right choice
  when workers/`OffscreenCanvas` aren't available. Each player instance plays a
  single animation; create a new one per animation.

## Configuration

`AnimationConfiguration` (all optional) includes `loopAnimation`, `stopAtFrame`,
`backgroundColor`, `spriteAtlasWidth`/`spriteAtlasHeight`, `spritesCapacity`,
`devicePixelRatio`, `supportDeviceLost`, and a `compatibility` block
(`textLayerPlacement` / `solidLayerRendering`, each `"spec"` or `"babylon8"`).
Atlas size and devicePixelRatio default to `0` = auto-detect from GPU caps.

## How it maps to lite-gl

| Babylon `lottiePlayer` (core) | This package (lite-gl) |
| --- | --- |
| `new ThinEngine(...)` | `createGLEngine(...)` |
| `engine.clear(...)` / `setSize` / `setViewport` | `clear` / `setGLEngineSize` / `setViewport` |
| `createDynamicTexture` / `updateDynamicTexture` / `ThinTexture` | `createDynamicTexture` / `updateDynamicTexture` (lite-gl `GLTexture`) |
| `SpriteRenderer` + `ThinSprite` (manual `_xOffset/_ySize` UV rects) | `createSpriteRenderer` + `GLSprite` (`uOffset`/`vOffset`/`uSize`/`vSize`) |

## Demo

A runnable demo lives in the repo's GL lab at `lab/gl/lottie.html`
(`pnpm dev:lab`, then open `/gl/lottie.html`).

## License

Apache-2.0
