// @ts-nocheck -- vendored Babylon.js lottiePlayer reference (parity baseline); not maintained here
import { type LottieFeature } from "./feature";
import { ShapeLayerFeature } from "./layers/shapeLayer";

const ShapeLottieFeature = {
    id: "shape",
    layerTypes: [4],
    shapeLayer: ShapeLayerFeature,
} as const satisfies LottieFeature;

export default ShapeLottieFeature;
