export type { AnimationConfiguration, LottieCompatibilityMode, LottieCompatibilityOptions } from "./animationConfiguration";
export { Player } from "./player";
export { LocalPlayer } from "./localPlayer";
export { CreatePlayer, PreWarmPlayerAsync, PlayAnimationAsync, DisposePlayer } from "./playerRuntime";
export type { PlayerState } from "./playerRuntime";
export { CreateLocalPlayer, PlayLocalAnimationAsync, DisposeLocalPlayer } from "./localPlayerRuntime";
export type { LocalPlayerState } from "./localPlayerRuntime";
export type { AnimationInput } from "./types";
export type { RawLottieAnimation } from "./parsing/rawTypes";
// Lower-level building blocks for deterministic single-frame rendering (static
// posters, thumbnails, parity captures): drive an AnimationController directly.
export { AnimationController } from "./rendering/animationController";
export { GetRawAnimationDataAsync } from "./parsing/rawAnimation";
export { CalculateScaleFactors } from "./rendering/calculateScaleFactor";
export type { ScaleFactors } from "./rendering/calculateScaleFactor";
