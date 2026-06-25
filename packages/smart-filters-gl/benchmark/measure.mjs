// Bundle-size measurer. Bundles an entry with esbuild (minified, ESM, tree-shaken)
// and reports raw + gzip + brotli bytes.
//
//   node measure.mjs <entry.ts> "<label>" [aliasJSON]
//
// The optional alias map lets the lite entry resolve the workspace TS packages
// directly, e.g.:
//   '{"babylon-lite-gl":"<abs>/packages/babylon-lite-gl/src/index.ts",
//     "smart-filters-gl":"<abs>/packages/smart-filters-gl/src/index.ts"}'
import { build } from "esbuild";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

const entry = process.argv[2];
const label = process.argv[3] ?? entry;
const aliasArg = process.argv[4];
const alias = aliasArg ? JSON.parse(aliasArg) : undefined;

const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    treeShaking: true,
    platform: "browser",
    target: "es2020",
    write: false,
    legalComments: "none",
    logLevel: "warning",
    alias,
});

const out = result.outputFiles[0].contents;
const raw = out.length;
const gz = gzipSync(out, { level: 9 }).length;
const br = brotliCompressSync(out, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

const kb = (n) => (n / 1024).toFixed(1);
console.log(JSON.stringify({ label, rawKB: kb(raw), gzipKB: kb(gz), brotliKB: kb(br) }));
