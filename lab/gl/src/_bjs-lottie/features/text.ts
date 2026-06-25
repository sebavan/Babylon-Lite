// @ts-nocheck -- vendored Babylon.js lottiePlayer reference (parity baseline); not maintained here
import { type LottieFeature } from "./feature";
import { TextLayerFeature } from "./layers/textLayer";

const TextLottieFeature = {
    id: "text",
    layerTypes: [5],
    textLayer: TextLayerFeature,
} as const satisfies LottieFeature;

export default TextLottieFeature;
