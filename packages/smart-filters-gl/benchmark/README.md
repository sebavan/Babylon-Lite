# Bundle-size comparison

Measures the production bundle of a **minimal SmartFilter app** rendered two ways. Both entries
build the exact same graph — `InputBlock(texture) → PixelateBlock → output` — then
`createRuntimeAsync()` + `render()`. The only difference is the rendering backend, so the delta is
purely the engine/runtime cost.

- `babylon-entry.ts` — current **`@babylonjs/smart-filters` + `@babylonjs/core`** runtime (baseline).
- `lite-entry.ts` — the ported **`smart-filters-gl` + `babylon-lite-gl`** runtime (this package).

Each is bundled with esbuild (`--bundle --minify --format=esm`, tree-shaken) and measured raw / gzip
/ brotli by `measure.mjs`.

## Results

| Variant | Raw | Gzip | Brotli |
| --- | --- | --- | --- |
| `@babylonjs/smart-filters` + `@babylonjs/core` (v9.14.0) | **233.1 KB** | **59.9 KB** | 50.7 KB |
| `smart-filters-gl` + `babylon-lite-gl` (ported) | **30.6 KB** | **9.7 KB** | 8.7 KB |
| **Reduction** | **7.6× (−87%)** | **6.2× (−84%)** | 5.8× (−83%) |

The baseline is dominated by `@babylonjs/core`'s `ThinEngine` + `EffectRenderer` + `Effect` + texture
loading. The ported runtime pulls in only the `babylon-lite-gl` micro-engine.

## Reproduce

**Ported (lite) side** — resolve the workspace packages via esbuild aliases (run from repo root):

```bash
node packages/smart-filters-gl/benchmark/measure.mjs \
  packages/smart-filters-gl/benchmark/lite-entry.ts \
  "smart-filters-gl + babylon-lite-gl" \
  '{"babylon-lite-gl":"<ABS>/packages/babylon-lite-gl/src/index.ts","smart-filters-gl":"<ABS>/packages/smart-filters-gl/src/index.ts"}'
```

**Baseline (Babylon) side** — `@babylonjs/*` are NOT in this workspace, so measure from an isolated
install:

```bash
mkdir sf-baseline && cd sf-baseline && npm init -y
npm i @babylonjs/core@9.14.0 @babylonjs/smart-filters@9.14.0 esbuild
# copy babylon-entry.ts + measure.mjs here, then:
node measure.mjs ./babylon-entry.ts "@babylonjs/smart-filters + core"
```

> Note: esbuild honours a Yarn PnP `.pnp.cjs` if one exists in a parent directory — run the isolated
> install somewhere without a PnP ancestor.
