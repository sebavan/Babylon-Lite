import { AttachSprite } from "../nodes/node";
import { type LottieSpriteRecord } from "../parsing/spriteRecord";
import { type SpritePacker } from "../parsing/spritePacker";
import { type RenderingManager } from "./renderingManager";
import { type LottieSprite } from "./lottieSprite";

/**
 * Translates renderer-agnostic {@link LottieSpriteRecord}s produced by parsing into lite-gl
 * {@link LottieSprite}s, attaches each sprite to its scene-graph node, registers it for rendering, and
 * finalizes the rendering manager. This adapter is the only place that knows about the lite-gl
 * sprite representation; replacing the rendering backend means replacing this module, not the parser or
 * feature modules.
 *
 * The record's `uOffset`/`vOffset` are normalized atlas offsets and `uSize`/`vSize` are cell sizes in
 * texels — the exact semantics of Babylon's `ThinSprite._xOffset/_yOffset/_xSize/_ySize`, which lite-gl's
 * sprite renderer consumes verbatim through the manual-UV path.
 * @param records - Sprite records emitted during parsing, in creation order.
 * @param packer - Sprite atlas packer holding the finalized atlas page textures.
 * @param renderingManager - Rendering manager that batches and draws the sprites.
 */
export function MaterializeSpriteRecords(records: readonly LottieSpriteRecord[], packer: SpritePacker, renderingManager: RenderingManager): void {
    for (let i = 0; i < records.length; i++) {
        const record = records[i]!;

        const sprite: LottieSprite = {
            position: { x: 0, y: 0, z: 0 },
            width: record.width,
            height: record.height,
            angle: 0,
            // Opaque white tint; the alpha channel is rewritten every frame from the node opacity.
            color: { r: 1, g: 1, b: 1, a: 1 },
            // Manual UV rect — offsets normalized, sizes in texels (Babylon ThinSprite semantics).
            uOffset: record.uOffset,
            vOffset: record.vOffset,
            uSize: record.uSize,
            vSize: record.vSize,
            invertV: record.invertV,
        };

        AttachSprite(record.node, sprite);
        renderingManager.addSprite(sprite, record.layerOrder, record.atlasIndex);
    }

    // Sprites are registered; finalize the renderer with the packed atlas textures.
    renderingManager.ready(packer.textures);
}
