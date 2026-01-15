// 纹理配置模块 - 文本框纹理叠加效果
// Requirements: 1.1, 1.2

// 纹理类型枚举
export type TextureType = 'matte-paper' | 'silk' | 'ink-wash' | 'none';

// 纹理配置接口
export interface TextureConfig {
  id: TextureType;
  name: string;
  pattern: 'noise' | 'diagonal-lines' | 'cloud' | 'none';
  opacity: number;  // 透明度 0.08-0.15
  scale: number;    // 纹理缩放
}

// 纹理预设配置（磨砂黑纸、深色丝绸、水墨晕染）
export const TEXTURE_PRESETS: Record<TextureType, TextureConfig> = {
  'matte-paper': {
    id: 'matte-paper',
    name: '磨砂黑纸',
    pattern: 'noise',
    opacity: 0.12,
    scale: 1.0
  },
  'silk': {
    id: 'silk',
    name: '深色丝绸',
    pattern: 'diagonal-lines',
    opacity: 0.10,
    scale: 0.8
  },
  'ink-wash': {
    id: 'ink-wash',
    name: '水墨晕染',
    pattern: 'cloud',
    opacity: 0.08,
    scale: 1.2
  },
  'none': {
    id: 'none',
    name: '无纹理',
    pattern: 'none',
    opacity: 0,
    scale: 1.0
  }
} as const;

// 默认纹理类型
export const DEFAULT_TEXTURE_TYPE: TextureType = 'matte-paper';

// 获取纹理配置
export function getTextureConfig(textureType: TextureType): TextureConfig {
  return TEXTURE_PRESETS[textureType] || TEXTURE_PRESETS['matte-paper'];
}

// 获取所有纹理选项（用于UI选择器）
export function getTextureOptions(): Array<{ id: TextureType; name: string }> {
  return Object.values(TEXTURE_PRESETS).map(config => ({
    id: config.id,
    name: config.name
  }));
}
