import { type GLEffectWrapperOptions } from "babylon-lite-gl";
import { type ShaderCode } from "./shaderCode.types.js";

/**
 * The shader code decorator.
 * Used to decorate the names of uniform, function and const variables for easier parsing.
 */
export const DecorateChar = "_";

/**
 * Custom fullscreen-quad vertex shader (GLSL ES 3.00).
 *
 * Adaptation: lite-gl's BUILT-IN fullscreen vertex shader exposes a `vUv` (lowercase) varying, but
 * SmartFilter fragments reference `vUV` (uppercase). We therefore supply our own vertex shader that
 * emits a `vUV` varying so the names line up. The fullscreen quad positions are bound to attribute
 * location 0 (named `position`, lite-gl's default attribute) by the engine.
 */
export const FullscreenVertexSource = `#version 300 es
layout(location=0) in vec2 position;
out vec2 vUV;
void main(void) {
    vUV = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

/**
 * Describes a shader program.
 */
export type ShaderProgram = {
    /**
     * The vertex shader code.
     */
    vertex?: string | undefined;

    /**
     * The fragment shader code.
     */
    fragment: ShaderCode;
};

/**
 * Creates a copy of a ShaderProgram so it can be modified without other instances being affected.
 * @param shaderProgram - The shader program to clone
 * @returns A new ShaderProgram instance
 */
export function CloneShaderProgram(shaderProgram: ShaderProgram): ShaderProgram {
    return {
        vertex: shaderProgram.vertex,
        fragment: {
            ...shaderProgram.fragment,
        },
    };
}

export const AutoDisableMainInputColorName = "autoMainInputColor";
export const DisableUniform = "disabled";

/**
 * Injects the disable uniform and adds a check for it at the beginning of the main function
 * @param shaderProgram - The shader program to inject the disable feature into
 */
export function InjectAutoSampleDisableCode(shaderProgram: ShaderProgram): void {
    const shaderFragment = shaderProgram.fragment;

    // Inject the disable uniform
    shaderFragment.uniform = (shaderFragment.uniform ?? "") + `\nuniform bool ${DecorateSymbol(DisableUniform)};`;

    // Find the main function
    const mainFunction = shaderFragment.functions.find((f) => f.name === shaderFragment.mainFunctionName);
    if (!mainFunction) {
        throw new Error(`Main function not found when trying to inject auto disable into ${shaderFragment.mainFunctionName}`);
    }

    // Ensure the shader has a main input texture
    if (!shaderFragment.mainInputTexture) {
        throw new Error(`Main input texture not found when trying to inject auto disable into ${shaderFragment.mainFunctionName}`);
    }

    // Inject the code
    const autoDisableVariableName = DecorateSymbol(AutoDisableMainInputColorName);
    mainFunction.code = mainFunction.code.replace(
        "{",
        `{\n    vec4 ${autoDisableVariableName} = texture2D(${shaderFragment.mainInputTexture}, vUV);\n
                if (${DecorateSymbol(DisableUniform)}) return ${autoDisableVariableName};\n`
    );
}

/**
 * Gets the shader fragment code.
 * @param shaderProgram - The shader program to extract the code from.
 * @param mainCodeOnly - If true, only the main function code will be returned.
 * @returns The shader fragment code.
 */
export function GetShaderFragmentCode(shaderProgram: ShaderProgram, mainCodeOnly = false): string {
    const shaderFragment = shaderProgram.fragment;

    const declarations =
        (shaderFragment.const ?? "") + "\n" + (shaderFragment.constPerInstance ?? "") + "\n" + (shaderFragment.uniform ?? "") + "\n" + (shaderFragment.uniformSingle ?? "") + "\n";

    let mainFunctionCode = "";
    let otherFunctionsCode = "";
    for (let i = 0; i < shaderFragment.functions.length; ++i) {
        const func = shaderFragment.functions[i]!;
        if (func.name === shaderFragment.mainFunctionName) {
            mainFunctionCode += func.code + "\n";
            if (mainCodeOnly) {
                break;
            }
        } else {
            otherFunctionsCode += func.code + "\n";
        }
    }

    return mainCodeOnly ? mainFunctionCode : declarations + otherFunctionsCode + mainFunctionCode;
}

/**
 * Gets the shader creation options from a shader program.
 *
 * Adaptation (THE CRUX): SmartFilter shaders are authored as GLSL ES 1.0 (they call `texture2D`,
 * read a `varying vec2 vUV`, and write `gl_FragColor`). lite-gl's `createEffect` expects RAW GLSL ES
 * 3.00. This function assembles a GLSL ES 3.00 fragment shader:
 *  - prepend `#version 300 es` + `precision highp float;`
 *  - expose the varying as `in vec2 vUV;`
 *  - declare an explicit `out vec4 glFragColor;`
 *  - write the result to `glFragColor` instead of `gl_FragColor`
 *  - rewrite `texture2D(`/`texture3D(` to the unified GLSL 3 `texture(` (post-assembly, so any
 *    injected sampler calls are converted too)
 * It also supplies the custom {@link FullscreenVertexSource} so the `vUV` varying name matches.
 * @param shaderProgram - The shader program to build the create options from.
 * @returns The lite-gl effect wrapper creation options.
 */
export function GetShaderCreateOptions(shaderProgram: ShaderProgram): GLEffectWrapperOptions {
    const shaderFragment = shaderProgram.fragment;

    let code = GetShaderFragmentCode(shaderProgram);

    const uniforms = (shaderFragment.uniform ?? "") + "\n" + (shaderFragment.uniformSingle ?? "");
    const uniformNames: string[] = [];
    const samplerNames: string[] = [];

    const rx = new RegExp(`uniform\\s+(\\S+)\\s+(\\w+)\\s*;`, "g");

    let match = rx.exec(uniforms);
    while (match !== null) {
        const varType = match[1]!;
        const varName = match[2]!;

        if (varType === "sampler2D" || varType === "sampler3D") {
            samplerNames.push(varName);
        } else {
            uniformNames.push(varName);
        }

        match = rx.exec(uniforms);
    }

    // Assemble the GLSL ES 3.00 fragment shader. See the JSDoc above for the rationale.
    code =
        "#version 300 es\n" +
        "precision highp float;\n" +
        "in vec2 vUV;\n" +
        "out vec4 glFragColor;\n" +
        code +
        "\nvoid main(void) {\nglFragColor = " +
        shaderFragment.mainFunctionName +
        "(vUV);\n}";

    // GLSL ES 1.0 -> 3.00 sampler intrinsics. Applied AFTER assembly so that any injected texture2D
    // (e.g. from InjectAutoSampleDisableCode) is converted as well.
    code = code.replace(/texture2D\(/g, "texture(").replace(/texture3D\(/g, "texture(");

    const options: GLEffectWrapperOptions = {
        name: shaderFragment.mainFunctionName,
        vertexSource: shaderProgram.vertex ?? FullscreenVertexSource,
        fragmentSource: code,
        uniformNames: uniformNames,
        samplerNames: samplerNames,
    };

    const defines = shaderFragment.defines;
    if (defines && defines.length > 0) {
        // Adaptation: Babylon used `string[]`; lite-gl wants a single `defines` string.
        options.defines = defines.join("\n");
    }

    return options;
}

/**
 * Decorates a symbol (uniform, function or const) name.
 * @param symbol - The symbol to decorate.
 * @returns The decorated symbol.
 */
export function DecorateSymbol(symbol: string): string {
    return DecorateChar + symbol + DecorateChar;
}

/**
 * Undecorates a symbol (uniform, function or const) name.
 * @param symbol - The symbol to undecorate.
 * @returns The undecorated symbol. Throws an error if the symbol is not decorated.
 */
export function UndecorateSymbol(symbol: string): string {
    if (symbol.charAt(0) !== DecorateChar || symbol.charAt(symbol.length - 1) !== DecorateChar) {
        throw new Error(`undecorateSymbol: Invalid symbol name "${symbol}"`);
    }

    return symbol.substring(1, symbol.length - 1);
}
