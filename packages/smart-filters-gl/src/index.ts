// Public API of the smart-filters-gl package.
//
// SmartFilter runtime ported from `@babylonjs/core`-based Babylon.js SmartFilters to the
// `babylon-lite-gl` rendering backend. Exports are explicit and named (no `export *`), mirroring the
// babylon-lite-gl index convention.

// ---------------------------------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------------------------------
export type { Nullable, IColor3Like, IColor4Like, IVector2Like, TextureSize } from "./types.js";
export type { IDisposable } from "./IDisposable.js";

// ---------------------------------------------------------------------------------------------------
// Command buffer
// ---------------------------------------------------------------------------------------------------
export { CreateCommand } from "./command/command.js";
export type { ICommandOwner, CommandAction, Command } from "./command/command.js";
export { CommandBuffer } from "./command/commandBuffer.js";
export type { CommandsVisitor } from "./command/commandBuffer.js";

// ---------------------------------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------------------------------
export { ConnectionPointType } from "./connection/connectionPointType.js";
export type { ConnectionPointValue, AllConnectionPointTypes } from "./connection/connectionPointType.js";
export { ConnectionPointDirection } from "./connection/connectionPointDirection.js";
export { ConnectionPointCompatibilityState, GetCompatibilityIssueMessage } from "./connection/connectionPointCompatibilityState.js";
export { ConnectionPoint } from "./connection/connectionPoint.js";
export type { RuntimeData } from "./connection/connectionPoint.js";
export { ConnectionPointWithDefault } from "./connection/connectionPointWithDefault.js";

// ---------------------------------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------------------------------
export { CreateStrongRef } from "./utils/strongRef.js";
export type { StrongRef } from "./utils/strongRef.js";
export { UniqueIdGenerator } from "./utils/uniqueIdGenerator.js";
export type { ShaderCode, ShaderFunction } from "./utils/shaderCode.types.js";
export {
    DecorateChar,
    FullscreenVertexSource,
    CloneShaderProgram,
    AutoDisableMainInputColorName,
    DisableUniform,
    InjectAutoSampleDisableCode,
    GetShaderFragmentCode,
    GetShaderCreateOptions,
    DecorateSymbol,
    UndecorateSymbol,
} from "./utils/shaderCodeUtils.js";
export type { ShaderProgram } from "./utils/shaderCodeUtils.js";
export { GetBlockOutputTextureSize, waitForTextureReady } from "./utils/textureUtils.js";
export { RegisterFinalRenderCommand } from "./utils/renderTargetUtils.js";

// ---------------------------------------------------------------------------------------------------
// Block foundation
// ---------------------------------------------------------------------------------------------------
export { TextureFormat, TextureType, TextureOptionsMatch } from "./blockFoundation/textureOptions.js";
export type { OutputTextureOptions } from "./blockFoundation/textureOptions.js";
export { BaseBlock } from "./blockFoundation/baseBlock.js";
export type { BlockVisitor } from "./blockFoundation/baseBlock.js";
export { InputBlock, InputBlockBase, IsTextureInputBlock } from "./blockFoundation/inputBlock.js";
export type { AnyInputBlock, InputBlockEditorData } from "./blockFoundation/inputBlock.js";
export { OutputBlock } from "./blockFoundation/outputBlock.js";
export { ShaderBlock } from "./blockFoundation/shaderBlock.js";

// ---------------------------------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------------------------------
export { ShaderBinding, DisableableShaderBinding, ShaderRuntime } from "./runtime/shaderRuntime.js";
export type { IDisableableBlock } from "./runtime/shaderRuntime.js";
export { InternalSmartFilterRuntime } from "./runtime/smartFilterRuntime.js";
export type { SmartFilterRuntime } from "./runtime/smartFilterRuntime.js";
export { RenderTargetGenerator } from "./runtime/renderTargetGenerator.js";

// ---------------------------------------------------------------------------------------------------
// Smart filter
// ---------------------------------------------------------------------------------------------------
export { SmartFilter } from "./smartFilter.js";
export type { InitializationData } from "./smartFilter.js";

// ---------------------------------------------------------------------------------------------------
// Example blocks
// ---------------------------------------------------------------------------------------------------
export { PixelateBlock } from "./blocks/pixelateBlock.js";
export { BlackAndWhiteBlock } from "./blocks/blackAndWhiteBlock.js";
