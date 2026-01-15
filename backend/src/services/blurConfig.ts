// 毛玻璃模糊效果配置模块
// Requirements: 3.1, 3.2

// 模糊强度类型枚举
export type BlurIntensity = 'light' | 'medium' | 'strong';

// 模糊配置接口
export interface BlurConfig {
  id: BlurIntensity;
  name: string;
  blur: number;      // 模糊半径 (8-16px)
  opacity: number;   // 背景透明度 (0.75-0.90)
}

// 模糊强度预设配置（轻度8px、中度12px、强度16px）
// Requirements: 3.1, 3.2
export const BLUR_PRESETS: Record<BlurIntensity, BlurConfig> = {
  'light': {
    id: 'light',
    name: '轻度',
    blur: 8,
    opacity: 0.90
  },
  'medium': {
    id: 'medium',
    name: '中度',
    blur: 12,
    opacity: 0.85
  },
  'strong': {
    id: 'strong',
    name: '强度',
    blur: 16,
    opacity: 0.78
  }
} as const;

// 默认模糊强度
export const DEFAULT_BLUR_INTENSITY: BlurIntensity = 'medium';

// 获取模糊配置
export function getBlurConfig(blurIntensity: BlurIntensity): BlurConfig {
  return BLUR_PRESETS[blurIntensity] || BLUR_PRESETS['medium'];
}

// 验证模糊强度是否有效
export function isValidBlurIntensity(blurIntensity: string): blurIntensity is BlurIntensity {
  return blurIntensity in BLUR_PRESETS;
}

// 获取所有模糊选项
export function getBlurOptions(): Array<{ id: BlurIntensity; name: string; blur: number }> {
  return Object.values(BLUR_PRESETS).map(config => ({
    id: config.id,
    name: config.name,
    blur: config.blur
  }));
}
