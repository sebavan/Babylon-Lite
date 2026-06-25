/**
 * Local, engine-agnostic type aliases for the smart-filters-gl port.
 *
 * The upstream Babylon SmartFilter runtime pulls these from `@babylonjs/core`
 * (`core/types`, `core/Maths/math.like`, `core/Materials/Textures/textureCreationOptions`).
 * This port has a single engine dependency — `babylon-lite-gl` — so we redefine
 * the handful of structural types we actually use as plain data here.
 */

/**
 * A value that may be `null`. Mirrors Babylon's `core/types` `Nullable<T>`.
 */
export type Nullable<T> = T | null;

/**
 * A plain RGB color, components in the 0..1 range. Structural stand-in for
 * Babylon's `IColor3Like`.
 */
export interface IColor3Like {
    /** Red component (0..1). */
    r: number;
    /** Green component (0..1). */
    g: number;
    /** Blue component (0..1). */
    b: number;
}

/**
 * A plain RGBA color, components in the 0..1 range. Structural stand-in for
 * Babylon's `IColor4Like`.
 */
export interface IColor4Like {
    /** Red component (0..1). */
    r: number;
    /** Green component (0..1). */
    g: number;
    /** Blue component (0..1). */
    b: number;
    /** Alpha component (0..1). */
    a: number;
}

/**
 * A plain 2D vector. Structural stand-in for Babylon's `IVector2Like`.
 */
export interface IVector2Like {
    /** X component. */
    x: number;
    /** Y component. */
    y: number;
}

/**
 * The pixel dimensions of a texture / render target. Structural stand-in for
 * the object form of Babylon's `TextureSize`.
 */
export type TextureSize = {
    /** Width in pixels. */
    width: number;
    /** Height in pixels. */
    height: number;
};
