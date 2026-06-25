import { type GLEngineContext, clearEngine, GLBlendMode } from "babylon-lite-gl";
import { createSpriteRenderer, disposeSpriteRenderer, renderSprites, setSpriteRendererTexture, type GLSpriteRenderer } from "babylon-lite-gl/sprites";
import { type GLTexture } from "babylon-lite-gl";

import { type LottieSprite } from "./lottieSprite";
import { type ThinMatrix } from "../maths/matrix";

import { type LottieRendererConfig } from "../animationConfiguration";

/**
 * Represents all the sprites from the animation and manages their rendering on
 * `@babylonjs/lite-gl`. Supports multiple atlas pages — when sprites span more
 * than one texture, render() performs one pass per page, switching the sprite
 * renderer texture between passes.
 *
 * This is the lite-gl replacement for the Babylon `SpriteRenderer`-backed
 * rendering manager. Every lottie sprite addresses its atlas cell via a manual
 * UV rect (`uOffset`/`vOffset`/`uSize`/`vSize`), so no fixed `cellIndex` grid is
 * configured on the renderer.
 */
export class RenderingManager {
    private readonly _engine: GLEngineContext;
    private _spritesRenderer: GLSpriteRenderer | null;
    private _spritesTextures: GLTexture[];
    private _sprites: LottieSprite[];
    private _spriteLayerIndices: number[];
    private _spriteAtlasIndices: number[];
    private _batches: { sprites: LottieSprite[]; pageIndex: number }[];
    private readonly _configuration: LottieRendererConfig;

    /**
     * Creates a new instance of the RenderingManager.
     * @param engine - lite-gl engine context used for rendering.
     * @param configuration - Configuration options for the rendering manager.
     */
    public constructor(engine: GLEngineContext, configuration: LottieRendererConfig) {
        this._engine = engine;
        this._spritesRenderer = null;
        this._spritesTextures = [];
        this._sprites = [];
        this._spriteLayerIndices = [];
        this._spriteAtlasIndices = [];
        this._batches = [];
        this._configuration = configuration;
    }

    /**
     * Adds a sprite to the rendering manager.
     * @param sprite - Sprite to add to the rendering manager.
     * @param layerIndex - The original layer index from the Lottie file, used to determine rendering order.
     * @param atlasIndex - The atlas page index this sprite belongs to.
     */
    public addSprite(sprite: LottieSprite, layerIndex: number, atlasIndex: number): void {
        this._sprites.push(sprite);
        this._spriteLayerIndices.push(layerIndex);
        this._spriteAtlasIndices.push(atlasIndex);
    }

    /**
     * Prepares the rendering manager for rendering.
     * Sorts sprites so they render back-to-front based on the original Lottie layer order.
     * In Lottie, layer 0 is the frontmost (rendered last), so higher indices render first (further back).
     * Within the same layer, later-added sprites render first (further back).
     *
     * Creates the sprite renderer sized to the actual sprite count and sets the atlas textures.
     * @param spriteTextures - The final array of atlas page textures, captured after all sprites have been packed.
     */
    public ready(spriteTextures: GLTexture[]): void {
        // Capture the final set of atlas textures now that all sprites have been packed
        this._spritesTextures = spriteTextures;

        // Build index array and stable-sort by original layer index descending
        const count = this._sprites.length;
        const indices = new Array<number>(count);
        for (let i = 0; i < count; i++) {
            indices[i] = i;
        }
        indices.sort((a, b) => {
            const layerDiff = this._spriteLayerIndices[b]! - this._spriteLayerIndices[a]!;
            if (layerDiff !== 0) {
                return layerDiff;
            }
            // Within the same layer, later-added sprites are further back (rendered first)
            return b - a;
        });
        this._sprites = indices.map((i) => this._sprites[i]!);
        this._spriteAtlasIndices = indices.map((i) => this._spriteAtlasIndices[i]!);

        // Layer indices are no longer needed after sorting
        this._spriteLayerIndices.length = 0;

        // Create the sprite renderer now that the atlas pages (and sprite count) are known.
        // Unlike Babylon's SpriteRenderer (created in the constructor and grown later),
        // lite-gl's createSpriteRenderer requires a texture up front, so it is built here.
        const capacity = Math.max(this._configuration.spritesCapacity, this._sprites.length, 1);
        if (this._spritesRenderer !== null) {
            disposeSpriteRenderer(this._spritesRenderer);
        }
        this._spritesRenderer = createSpriteRenderer(this._engine, {
            capacity,
            texture: this._spritesTextures[0]!,
            // Babylon's SpriteRenderer default blendMode is ALPHA_COMBINE (lite-gl ALPHA);
            // its render() re-applies it every frame, overriding the engine alpha mode.
            blendMode: GLBlendMode.ALPHA,
            // The lottie engine sets its alpha mode once and never resets between passes.
            autoResetAlpha: false,
            disableDepthWrite: true,
            // The lottie player builds its SpriteRenderer with epsilon 0
            // (`new SpriteRenderer(engine, capacity, 0)`): cells are edge-extruded and
            // solids sample the cell center, so no UV inset is needed — and a non-zero
            // inset would shrink every sprite quad by ~epsilon·size per edge.
            epsilon: 0,
        });

        // Pre-compute render batches so render() doesn't allocate per frame
        this._batches.length = 0;
        if (this._sprites.length > 0 && this._spritesTextures.length > 1) {
            let batchStart = 0;
            let currentPage = this._spriteAtlasIndices[0]!;

            for (let i = 1; i <= this._sprites.length; i++) {
                const page = i < this._sprites.length ? this._spriteAtlasIndices[i]! : -1;
                if (page !== currentPage) {
                    this._batches.push({ sprites: this._sprites.slice(batchStart, i), pageIndex: currentPage });
                    batchStart = i;
                    currentPage = page;
                }
            }
        }
    }

    /**
     * Renders all the sprites in the rendering manager.
     * When sprites span multiple atlas pages, renders in sorted z-order by batching
     * consecutive runs of sprites that share the same atlas page.
     * @param worldMatrix - World matrix to apply to the sprites.
     * @param projectionMatrix - Projection matrix to apply to the sprites.
     */
    public render(worldMatrix: ThinMatrix, projectionMatrix: ThinMatrix): void {
        clearEngine(this._engine, { color: this._configuration.backgroundColor });

        const renderer = this._spritesRenderer;
        if (renderer === null) {
            return;
        }

        const view = worldMatrix.asArray();
        const projection = projectionMatrix.asArray();

        if (this._batches.length === 0) {
            // Fast path: single atlas — render everything in one call
            renderSprites(renderer, this._sprites, 0, view, projection);
        } else {
            // Multi-atlas: iterate pre-computed batches (no per-frame allocations)
            for (const batch of this._batches) {
                setSpriteRendererTexture(renderer, this._spritesTextures[batch.pageIndex]!);
                renderSprites(renderer, batch.sprites, 0, view, projection);
            }
        }
    }

    /**
     * Disposes the rendering manager and its resources.
     */
    public dispose(): void {
        this._sprites.length = 0;
        if (this._spritesRenderer !== null) {
            // disposeSpriteRenderer never disposes the shared atlas texture — the
            // sprite packer owns those and disposes them separately.
            disposeSpriteRenderer(this._spritesRenderer);
            this._spritesRenderer = null;
        }
    }
}
