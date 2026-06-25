/**
 * Minimal structural type shims that the lottie player borrowed from
 * `@babylonjs/core` (`core/types`, `core/Maths/math.like`). They are reproduced
 * here verbatim so this package has **no dependency on `@babylonjs/core`** — the
 * renderer-agnostic parsing / node / maths / feature modules only ever needed
 * these *types*, never any core runtime value.
 */

/** `T` or `null` (≙ Babylon `core/types` `Nullable`). */
export type Nullable<T> = T | null;

// Fixed-length tuple builder, copied from Babylon `core/types`.
type _Tuple<T, N extends number, R extends unknown[] = []> = R["length"] extends N ? R : _Tuple<T, N, [T, ...R]>;

/** A tuple of `T` with length `N` (≙ Babylon `core/types` `Tuple`). */
export type Tuple<T, N extends number> = _Tuple<T, N>;

/** `{ x, y }` (≙ Babylon `core/Maths/math.like` `IVector2Like`). */
export interface IVector2Like {
    /** X component. */
    x: number;
    /** Y component. */
    y: number;
}

/** `{ x, y, z }` (≙ Babylon `core/Maths/math.like` `IVector3Like`). */
export interface IVector3Like extends IVector2Like {
    /** Z component. */
    z: number;
}

/** `{ r, g, b }` (≙ Babylon `core/Maths/math.like` `IColor3Like`). */
export interface IColor3Like {
    /** Red, 0..1. */
    r: number;
    /** Green, 0..1. */
    g: number;
    /** Blue, 0..1. */
    b: number;
}

/** `{ r, g, b, a }` (≙ Babylon `core/Maths/math.like` `IColor4Like`). */
export interface IColor4Like extends IColor3Like {
    /** Alpha, 0..1. */
    a: number;
}

/** The slice of Babylon's `IMatrixLike` the renderer relies on. */
export interface IMatrixLike {
    /** The 16 column-major matrix elements. */
    asArray(): Tuple<number, 16>;
    /** Monotonic dirty counter used to skip redundant uniform uploads. */
    updateFlag: number;
}
