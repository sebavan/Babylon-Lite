/**
 * Shared core for GL bundle sizing — imported by BOTH the build script
 * (build-bundle-scenes-gl.ts, which writes the dashboard manifest) AND the
 * bundle-size ceiling test (tests/gl/build/bundle-size.test.ts). Importing this
 * module has NO side effects (no auto-run), so the test can reuse the exact same
 * esbuild measurement the dashboard reports.
 *
 * Each @babylonjs/lite-gl lab scene is bundled INDEPENDENTLY as a standalone,
 * tree-shaken, minified ESM bundle, with `babylon-lite-gl` aliased to the package
 * SOURCE (packages/babylon-lite-gl/src/*.ts) so the measured size reflects the
 * true tree-shaken consumer cost rather than a pre-built barrel.
 */
import { build, type Plugin } from "esbuild";
import { gzipSync } from "zlib";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

export const repoRoot = resolve(__dirname, "..");
export const pkgSrc = resolve(repoRoot, "packages/babylon-lite-gl/src");
export const sceneSrcDir = resolve(repoRoot, "lab/gl/src");
export const demoSrcDir = resolve(repoRoot, "lab/gl/src/demos");
export const manifestPath = resolve(repoRoot, "lab/public/gl/bundle/manifest.json");
export const demosManifestPath = resolve(repoRoot, "lab/public/gl/bundle/demos-manifest.json");
export const sceneConfigPath = resolve(repoRoot, "scene-config-webgl.json");
export const demoConfigPath = resolve(repoRoot, "demos-config-webgl.json");

export interface SceneConfigEntry {
    id: number;
    slug: string;
    name: string;
    /** Raw (minified) bundle-size ceiling in KB. When set, the bundle-size test
     *  fails if the scene's standalone bundle grows past it. */
    maxRawKB?: number;
}

export interface BundleSize {
    rawKB: number;
    gzipKB: number;
}

export interface BundleManifestEntry {
    rawKB: number;
    gzipKB: number;
    /** Babylon ThinEngine equivalent (bundled from the parity ref); omitted when no ref exists. */
    bjsRawKB?: number;
    bjsGzipKB?: number;
}

// Map every `babylon-lite-gl` import specifier the scenes use to its TS source
// entry, mirroring the package.json `exports` map. Aliasing to source (not the
// built barrel) is what makes the measured size reflect real tree-shaken cost.
// Keys are matched by esbuild as an exact path OR a prefix followed by `/`, and
// esbuild prefers the longest matching alias — so the bare-package alias and the
// sub-path aliases coexist correctly (verified against scene4 / scene6).
export const liteGlAlias: Record<string, string> = {
    "babylon-lite-gl": resolve(pkgSrc, "index.ts"),
    "babylon-lite-gl/sprites": resolve(pkgSrc, "sprites.ts"),
    "babylon-lite-gl/html-texture": resolve(pkgSrc, "html-texture.ts"),
    "babylon-lite-gl/render-target": resolve(pkgSrc, "render-target.ts"),
    "babylon-lite-gl/mesh": resolve(pkgSrc, "mesh.ts"),
    "babylon-lite-gl/depth-stencil": resolve(pkgSrc, "depth-stencil.ts"),
    "babylon-lite-gl/scissor": resolve(pkgSrc, "scissor.ts"),
    "babylon-lite-gl/dynamic-texture": resolve(pkgSrc, "dynamic-texture.ts"),
    "babylon-lite-gl/text": resolve(pkgSrc, "text.ts"),
};

/** rawKB / gzipKB rounding identical to the lite bundler's bytesToRoundedKB. */
export function bytesToRoundedKB(bytes: number): number {
    return Math.round((bytes / 1024) * 10) / 10;
}

/**
 * esbuild shim for the Vite-only import features the WebGPU `babylon-lite` SOURCE uses — a GL
 * scene's parity reference imports it (e.g. `babylon-ref-scene15.ts` → the Slug text renderer the
 * lite-gl port is diffed against). The lite bundler is Vite-based and handles these natively; the
 * GL bundler is plain esbuild, so we translate the three the engine source reaches:
 *   - `?raw`            → inline the target file as a text string (WGSL shader sources)
 *   - `?url`            → a vendor asset URL (e.g. manifold.wasm); never bundled, mark external
 *   - `?worker(&inline)`→ an inlined Web Worker; esbuild has no worker pipeline, stub it (size ≈ 0)
 * No-op for lite-gl scenes and `@babylonjs/core` refs, which use none of these.
 */
const viteCompatPlugin: Plugin = {
    name: "vite-compat",
    setup(b) {
        b.onResolve({ filter: /\?raw$/ }, (args) => ({ path: resolve(args.resolveDir, args.path.replace(/\?raw$/, "")), namespace: "vite-raw" }));
        b.onLoad({ filter: /.*/, namespace: "vite-raw" }, (args) => ({ contents: readFileSync(args.path, "utf8"), loader: "text" }));
        b.onResolve({ filter: /\?url$/ }, (args) => ({ path: args.path, external: true }));
        b.onResolve({ filter: /\?worker(&inline)?$/ }, (args) => ({ path: args.path, namespace: "vite-worker" }));
        b.onLoad({ filter: /.*/, namespace: "vite-worker" }, () => ({ contents: "export default class {}", loader: "js" }));
    },
};

/** WebGPU `babylon-lite` vendor runtimes (mirrors the lite bundler's externalized set in
 *  scripts/bundle-scenes-core.ts `VENDOR_RUNTIMES`): native wasm/worker blobs that are bundle-
 *  EXEMPT like `text-shaper`. Externalizing them also drops their node-only imports (e.g. manifold
 *  pulls the `module` builtin). Only reached through a babylon-lite parity ref — no-op otherwise. */
const VENDOR_EXTERNALS = ["manifold-3d", "manifold-3d/*", "@babylonjs/havok", "@recast-navigation/*"];

/**
 * esbuild a single entry into a standalone, tree-shaken, minified ESM bundle and
 * return its raw + gzip size. `alias` is supplied for lite-gl scenes (to resolve
 * the package to source); the Babylon reference passes none so `@babylonjs/core`
 * resolves normally from node_modules.
 */
export async function measureBundle(entry: string, alias?: Record<string, string>): Promise<BundleSize> {
    const result = await build({
        entryPoints: [entry],
        bundle: true,
        minify: true,
        treeShaking: true,
        format: "esm",
        target: "esnext",
        platform: "browser",
        legalComments: "none",
        // `text-shaper` is the upstream vendor shaping blob behind the default text layout. Per
        // GUIDANCE it is bundle-EXEMPT (the WebGPU lite bundler subtracts it too): the engine/runtime
        // payload is what's gated, and a caller driving its own layout pays zero for text-shaper. Mark
        // it external so its bytes are never charged to a scene's ceiling. The VENDOR_EXTERNALS are the
        // same idea for the WebGPU `babylon-lite` parity ref's native runtimes. esbuild only
        // externalizes specifiers actually reached, so all are no-ops for scenes that don't import them.
        external: ["text-shaper", ...VENDOR_EXTERNALS],
        plugins: [viteCompatPlugin],
        ...(alias ? { alias } : {}),
        write: false,
        logLevel: "warning",
    });

    // With a single entry, no splitting and no sourcemap/CSS, esbuild emits
    // exactly one JS output. Sum defensively in case that ever changes.
    let bytes = 0;
    for (const file of result.outputFiles) {
        bytes += file.contents.byteLength;
    }
    if (bytes === 0) {
        throw new Error(`entry produced an empty bundle: ${entry}`);
    }

    const gzipBytes = gzipSync(Buffer.from(result.outputFiles[0]!.contents)).byteLength;

    return {
        rawKB: bytesToRoundedKB(bytes),
        gzipKB: bytesToRoundedKB(gzipBytes),
    };
}

/** Measure ONLY the lite-gl scene bundle (no Babylon ref) — used by the
 *  bundle-size ceiling test, which only gates the lite-gl payload. */
export async function measureSceneBundle(id: number): Promise<BundleSize> {
    const sceneEntry = resolve(sceneSrcDir, `scene${id}.ts`);
    if (!existsSync(sceneEntry)) {
        throw new Error(`GL scene source not found: ${sceneEntry}`);
    }
    return measureBundle(sceneEntry, liteGlAlias);
}

/** Measure a scene's lite-gl bundle AND its Babylon ThinEngine equivalent (from
 *  the parity reference) for the dashboard manifest. */
export async function bundleScene(id: number): Promise<BundleManifestEntry> {
    const lite = await measureSceneBundle(id);
    const out: BundleManifestEntry = { rawKB: lite.rawKB, gzipKB: lite.gzipKB };

    // Babylon ThinEngine equivalent: bundle the parity reference (which imports
    // @babylonjs/core) the same way, so the tab shows what a consumer ships using
    // stock Babylon for the identical scene. Optional — a scene with no ref simply
    // drops the BJS comparison row.
    const refEntry = resolve(sceneSrcDir, `babylon-ref-scene${id}.ts`);
    if (existsSync(refEntry)) {
        const bjs = await measureBundle(refEntry);
        out.bjsRawKB = bjs.rawKB;
        out.bjsGzipKB = bjs.gzipKB;
    } else {
        console.warn(`  scene${id}: no babylon-ref-scene${id}.ts — BJS comparison omitted`);
    }

    return out;
}

export function loadSceneConfig(): SceneConfigEntry[] {
    const config: SceneConfigEntry[] = JSON.parse(readFileSync(sceneConfigPath, "utf-8"));
    if (!Array.isArray(config) || config.length === 0) {
        throw new Error(`scene-config-webgl.json is empty or invalid: ${sceneConfigPath}`);
    }
    return config;
}

/** Build every scene's bundle and write the dashboard manifest. */
export async function buildGlBundleManifest(): Promise<void> {
    const config = loadSceneConfig();
    const manifest: Record<string, BundleManifestEntry> = {};

    for (const entry of config) {
        const size = await bundleScene(entry.id);
        manifest[`scene${entry.id}`] = size;
        const bjs = size.bjsRawKB != null ? ` | BJS ${size.bjsRawKB} KB min / ${size.bjsGzipKB} KB gzip (${(size.bjsGzipKB! / size.gzipKB).toFixed(1)}\u00d7)` : "";
        const ceil = entry.maxRawKB != null ? ` (ceiling ${entry.maxRawKB} KB)` : "";
        console.log(`  scene${entry.id} (${entry.slug}): ${size.rawKB} KB min${ceil} / ${size.gzipKB} KB gzip${bjs}`);
    }

    mkdirSync(resolve(manifestPath, ".."), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\n\u2713 Wrote gl/bundle/manifest.json (${Object.keys(manifest).length} scenes)`);
    console.log(`  ${manifestPath}`);
}

/** A GL demos-config-webgl.json entry (only the fields the bundler needs). */
export interface DemoConfigEntry {
    slug: string;
    name: string;
}

export function loadDemoConfig(): DemoConfigEntry[] {
    const config: DemoConfigEntry[] = JSON.parse(readFileSync(demoConfigPath, "utf-8"));
    if (!Array.isArray(config)) {
        throw new Error(`demos-config-webgl.json is empty or invalid: ${demoConfigPath}`);
    }
    return config;
}

/**
 * Measure a GL demo's standalone, tree-shaken lite-gl bundle. Returns `null` for
 * demos that REUSE a scene source (no dedicated `lab/gl/src/demos/<slug>.ts`,
 * e.g. `sine-bands` reuses `scene7.ts`) — their size is already reported by the
 * matching scene in the Bundle tab, so they are omitted from the demos manifest.
 */
export async function measureDemoBundle(slug: string): Promise<BundleSize | null> {
    const entry = resolve(demoSrcDir, `${slug}.ts`);
    if (!existsSync(entry)) {
        return null;
    }
    return measureBundle(entry, liteGlAlias);
}

/**
 * Build every dedicated GL demo's bundle and write the dashboard demos manifest
 * (`lab/public/gl/bundle/demos-manifest.json`, keyed by slug → { rawKB, gzipKB }),
 * consumed by the GL dashboard "Demos" tab to advertise each demo's real shipped
 * lite-gl size.
 */
export async function buildGlDemosManifest(): Promise<void> {
    const config = loadDemoConfig();
    const manifest: Record<string, BundleSize> = {};

    for (const entry of config) {
        const size = await measureDemoBundle(entry.slug);
        if (size === null) {
            console.log(`  demo ${entry.slug}: reuses a scene source — size shown in the Bundle tab`);
            continue;
        }
        manifest[entry.slug] = size;
        console.log(`  demo ${entry.slug}: ${size.rawKB} KB min / ${size.gzipKB} KB gzip`);
    }

    mkdirSync(resolve(demosManifestPath, ".."), { recursive: true });
    writeFileSync(demosManifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\n\u2713 Wrote gl/bundle/demos-manifest.json (${Object.keys(manifest).length} demos)`);
    console.log(`  ${demosManifestPath}`);
}
