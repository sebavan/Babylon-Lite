import type { GLSprite } from "babylon-lite-gl/sprites";

/**
 * The renderer sprite driven by a lottie node — a lite-gl {@link GLSprite} whose
 * `color` is non-optional (every lottie sprite carries an RGBA tint whose alpha
 * is rewritten each frame from the node's resolved opacity). Structurally a
 * {@link GLSprite}, so it is accepted directly by `renderSprites`.
 *
 * Replaces the Babylon `ThinSprite` the player used before the lite-gl
 * migration: only this type and the rendering adapter know about the concrete
 * sprite representation; parsing / node / feature modules stay renderer-agnostic.
 */
export type LottieSprite = GLSprite & { color: NonNullable<GLSprite["color"]> };
