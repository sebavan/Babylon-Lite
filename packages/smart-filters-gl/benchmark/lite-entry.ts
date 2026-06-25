// SIZE CANDIDATE — the ported runtime on babylon-lite-gl.
// Minimal SmartFilter app: InputBlock(texture) -> PixelateBlock -> output, then
// createRuntimeAsync + render. Same graph shape as babylon-entry.ts so the bundle
// comparison is apples-to-apples (the only difference is the rendering backend).
import { createGLEngine, loadTexture2D } from "babylon-lite-gl";
import { SmartFilter, InputBlock, ConnectionPointType, PixelateBlock } from "smart-filters-gl";

async function main(): Promise<void> {
    const canvas = document.createElement("canvas");
    const engine = createGLEngine(canvas);

    const smartFilter = new SmartFilter("pixelate-demo");
    const texture = loadTexture2D(engine, "image.jpg");

    const input = new InputBlock(smartFilter, "input", ConnectionPointType.Texture, texture);
    const pixelate = new PixelateBlock(smartFilter, "pixelate");

    input.output.connectTo(pixelate.input);
    pixelate.output.connectTo(smartFilter.output);

    const runtime = await smartFilter.createRuntimeAsync(engine);
    runtime.render();
}

void main();
