import { type GLTexture } from "babylon-lite-gl";
import { type IColor3Like, type IColor4Like, type IVector2Like, type Nullable } from "../types.js";

/**
 * Defines the type of a connection point.
 */
export enum ConnectionPointType {
    /** Float */
    Float = 1,
    /** Texture */
    Texture = 2,
    /** Color3 */
    Color3 = 3,
    /** Color4 */
    Color4 = 4,
    /** Boolean */
    Boolean = 5,
    /** Vector2 */
    Vector2 = 6,
}

/**
 * A union of all supported connection point types
 */
export type AllConnectionPointTypes =
    | ConnectionPointType.Float
    | ConnectionPointType.Texture
    | ConnectionPointType.Color3
    | ConnectionPointType.Color4
    | ConnectionPointType.Boolean
    | ConnectionPointType.Vector2;

/**
 * Retrieves the type of the value from the Connection point type.
 *
 * Adaptation: the `Texture` value type is a `babylon-lite-gl` {@link GLTexture}
 * (instead of Babylon's `ThinTexture`).
 */
// prettier-ignore
export type ConnectionPointValue<T extends ConnectionPointType = ConnectionPointType> =
    T extends ConnectionPointType.Float ? number :
    T extends ConnectionPointType.Texture ? Nullable<GLTexture> :
    T extends ConnectionPointType.Color3 ? IColor3Like :
    T extends ConnectionPointType.Color4 ? IColor4Like :
    T extends ConnectionPointType.Boolean ? boolean :
    T extends ConnectionPointType.Vector2 ? IVector2Like :
    never;
