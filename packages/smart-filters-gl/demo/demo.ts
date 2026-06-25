// Live demo of the ported SmartFilter runtime on babylon-lite-gl.
//
// Builds InputBlock(texture) -> [BlackAndWhiteBlock?] -> PixelateBlock -> output and renders to the
// canvas every frame. The intensity slider mutates the live StrongRef value; the B&W checkbox rebuilds
// the graph to prove multi-block chaining (each non-final block gets its own GLRenderTarget).

import { createGLEngine, loadTexture2D, type GLEngineContext, type GLTexture } from "babylon-lite-gl";
import {
    SmartFilter,
    InputBlock,
    ConnectionPointType,
    PixelateBlock,
    BlackAndWhiteBlock,
    type SmartFilterRuntime,
} from "../src/index.js";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const intensityEl = document.getElementById("intensity") as HTMLInputElement;
const valEl = document.getElementById("val") as HTMLSpanElement;
const bwEl = document.getElementById("bw") as HTMLInputElement;

const setStatus = (msg: string): void => {
    statusEl.textContent = msg;
};

/** Procedurally draw a colourful test image so pixelation is obvious. */
function makeTestImageDataUrl(size: number): string {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, "#ff5e62");
    grad.addColorStop(0.5, "#ffb347");
    grad.addColorStop(1, "#36d1dc");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);

    const colors = ["#1d2b64", "#f8cdda", "#43cea2", "#ffffff", "#8e2de2"];
    for (let i = 0; i < 14; i++) {
        g.fillStyle = colors[i % colors.length]!;
        g.beginPath();
        g.arc(((i * 97) % size), ((i * 53) % size), 18 + (i % 5) * 12, 0, Math.PI * 2);
        g.fill();
    }
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 8;
    for (let x = -size; x < size; x += 48) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + size, size);
        g.stroke();
    }
    g.fillStyle = "#0b0d12";
    g.font = "bold 72px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("LITE", size / 2, size / 2 - 40);
    g.fillText("GL", size / 2, size / 2 + 50);
    return c.toDataURL("image/png");
}

let engine: GLEngineContext;
let runtime: SmartFilterRuntime | null = null;
let currentPixelate: PixelateBlock | null = null;

/** (Re)build the smart filter graph + runtime for the current control state. */
async function rebuild(texture: GLTexture): Promise<void> {
    if (runtime) {
        runtime.dispose();
        runtime = null;
    }

    const sf = new SmartFilter("demo");
    const input = new InputBlock(sf, "source", ConnectionPointType.Texture, texture);
    const pixelate = new PixelateBlock(sf, "pixelate");

    if (bwEl.checked) {
        const bw = new BlackAndWhiteBlock(sf, "bw");
        input.output.connectTo(bw.input);
        bw.output.connectTo(pixelate.input);
    } else {
        input.output.connectTo(pixelate.input);
    }
    pixelate.output.connectTo(sf.output);

    runtime = await sf.createRuntimeAsync(engine);

    // Capture AFTER createRuntimeAsync: the binding reads `intensity.runtimeData` during init, and
    // that StrongRef is stable afterwards — so mutating its `.value` is observed every frame with no
    // rebuild. Apply the current slider value immediately.
    currentPixelate = pixelate;
    pixelate.intensity.runtimeData.value = Number(intensityEl.value);

    setStatus(`rendering · ${bwEl.checked ? "B&W → Pixelate" : "Pixelate"} · ${texture.width}×${texture.height} source`);
}

async function main(): Promise<void> {
    try {
        engine = createGLEngine(canvas, { alpha: false });
    } catch (e) {
        setStatus(`WebGL2 unavailable: ${(e as Error).message}`);
        return;
    }

    setStatus("loading texture…");
    const url = makeTestImageDataUrl(512);
    const texture = loadTexture2D(engine, url, { invertY: true });

    await rebuild(texture);

    intensityEl.addEventListener("input", () => {
        const v = Number(intensityEl.value);
        if (currentPixelate) {
            currentPixelate.intensity.runtimeData.value = v;
        }
        valEl.textContent = v.toFixed(2);
    });
    bwEl.addEventListener("change", () => {
        void rebuild(texture);
    });

    const frame = (): void => {
        if (runtime) {
            runtime.render();
        }
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    // Expose a tiny hook so automated tests can read back a pixel.
    (window as unknown as { __demoReady?: boolean }).__demoReady = true;
}

void main();
