import type { FunConfig } from "@/types/funConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 趣味彩蛋总开关：Konami 秘技樱花雨等。
 * 自包含、默认开启；不需要时改为 enable: false 即完全关闭。
 */
export const funConfig: FunConfig = withUserConfig("fun", {
	enable: true,
	konami: true,
});
