import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import dts from "vite-plugin-dts";

/**
 * Build config for `@babylonjs/lite-lottie` — the tree-shakeable Lottie player
 * that renders on `@babylonjs/lite-gl`. Mirrors the `babylon-lite-gl` package
 * build (ES lib, per-entry files, rolled-up d.ts, emitted publish manifest).
 *
 * lite-gl is kept EXTERNAL (peer-style): the workspace import specifier
 * `babylon-lite-gl` is rewritten to the published `@babylonjs/lite-gl` in both
 * the emitted `.js` and `.d.ts` so the shipped package resolves the real
 * dependency rather than the workspace alias.
 */

const WORKSPACE_NAME = "babylon-lite-gl";
const PUBLISHED_NAME = "@babylonjs/lite-gl";

/** Rewrite the workspace lite-gl specifier to its published name in emitted JS. */
function rewriteGlSpecifierJs(): Plugin {
    return {
        name: "rewrite-gl-specifier-js",
        renderChunk(code) {
            // Match `from "babylon-lite-gl"` / `from "babylon-lite-gl/sprites"` etc.
            const next = code.replace(/(["'])babylon-lite-gl(\/[\w-]+)?\1/g, (_m, q, sub) => `${q}${PUBLISHED_NAME}${sub ?? ""}${q}`);
            return next === code ? null : { code: next, map: null };
        },
    };
}

/** Rewrite the workspace lite-gl specifier to its published name in emitted d.ts. */
function rewriteGlSpecifierDts(outDir: string): Plugin {
    return {
        name: "rewrite-gl-specifier-dts",
        enforce: "post",
        closeBundle() {
            const dir = resolve(__dirname, outDir);
            if (!existsSync(dir)) {
                return;
            }
            for (const file of readdirSync(dir)) {
                if (!file.endsWith(".d.ts")) {
                    continue;
                }
                const p = resolve(dir, file);
                const src = readFileSync(p, "utf8");
                const next = src.replace(/(["'])babylon-lite-gl(\/[\w-]+)?\1/g, (_m, q, sub) => `${q}${PUBLISHED_NAME}${sub ?? ""}${q}`);
                if (next !== src) {
                    writeFileSync(p, next);
                }
            }
        },
    };
}

/** Emit a publish-ready package.json into the build output directory. */
function emitPackageJson(outDir: string): Plugin {
    return {
        name: "emit-package-json",
        writeBundle() {
            const dir = resolve(__dirname, outDir);
            const pkg = {
                name: "@babylonjs/lite-lottie",
                version: "0.1.0",
                description: "Tiny, tree-shakeable Lottie player rendering on @babylonjs/lite-gl (WebGL2) — the lite counterpart of Babylon.js' lottiePlayer.",
                keywords: ["babylon", "babylonjs", "lottie", "animation", "webgl", "webgl2", "lite", "sprite"],
                license: "Apache-2.0",
                repository: {
                    type: "git",
                    url: "https://github.com/BabylonJS/Babylon-Lite.git",
                    directory: "packages/babylon-lite-lottie",
                },
                homepage: "https://github.com/BabylonJS/Babylon-Lite/tree/main/packages/babylon-lite-lottie",
                type: "module",
                main: "./index.js",
                module: "./index.js",
                types: "./index.d.ts",
                sideEffects: false,
                exports: {
                    ".": { import: "./index.js", types: "./index.d.ts" },
                    "./local": { import: "./local.js", types: "./local.d.ts" },
                    "./worker": { import: "./worker.js", types: "./worker.d.ts" },
                },
                peerDependencies: {
                    [PUBLISHED_NAME]: "^0.1.0",
                },
            };
            writeFileSync(resolve(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
            const readme = resolve(__dirname, "README.md");
            if (existsSync(readme)) {
                copyFileSync(readme, resolve(dir, "README.md"));
            }
        },
    };
}

export default defineConfig(({ mode }) => {
    const outDir = mode === "prod" ? "dist/prod" : "dist";
    const isWatch = process.argv.includes("--watch");
    return {
        build: {
            lib: {
                entry: {
                    index: resolve(__dirname, "src/index.ts"),
                    local: resolve(__dirname, "src/local.ts"),
                    worker: resolve(__dirname, "src/worker.ts"),
                },
                formats: ["es"],
            },
            outDir,
            rollupOptions: {
                // lite-gl is a peer dependency — never bundled into the player.
                external: [/^babylon-lite-gl(\/.*)?$/],
                output: {
                    preserveModules: false,
                    entryFileNames: "[name].js",
                    chunkFileNames: "[name]-[hash].js",
                },
            },
            sourcemap: true,
            minify: mode === "prod" ? "esbuild" : false,
        },
        // The player spawns its render worker via `new Worker(new URL("./workerEntry",
        // import.meta.url))`; emit it as an ES-module chunk (top-level `worker` option). The
        // worker bundles its own copy of lite-gl so it is self-contained (bare specifiers can't
        // resolve in a blob worker).
        worker: {
            format: "es",
        },
        plugins: [
            rewriteGlSpecifierJs(),
            dts({
                rollupTypes: !isWatch,
                tsconfigPath: resolve(__dirname, "tsconfig.json"),
                outDir,
            }),
            ...(isWatch ? [] : [rewriteGlSpecifierDts(outDir)]),
            emitPackageJson(outDir),
        ],
    };
});
