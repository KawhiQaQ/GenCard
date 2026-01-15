/**
 * Frame Presets - 边框预设配置
 * 
 * 本文件定义了所有可用的边框预设配置，包括5种风格预设和"无边框"选项。
 * 
 * Requirements: 1.1, 1.3
 */

import { FramePresetId, FramePresetConfig } from '../types/frame';

/**
 * 边框预设配置映射
 * 
 * 包含所有可用的边框预设：
 * - cyber: 科技风
 * - classic: 古典风
 * - minimal: 简约风
 * - fantasy: 奇幻风
 * - battle: 战场风
 * - none: 无边框
 * 
 * Requirements: 1.1
 */
export const FRAME_PRESETS: Record<FramePresetId, FramePresetConfig> = {
  cyber: {
    id: 'cyber',
    name: '科技风',
    description: '金属质感、发光线条、几何图案',
    cornerAsset: 'frames/cyber/corner.svg',
    borderAsset: 'frames/cyber/border.svg',
    cornerSize: 100,
    borderThickness: 20,
    insetOffset: 10,
    colorScheme: {
      primary: '#00D4FF',
      secondary: '#0A1628',
      accent: '#FF00FF',
    },
  },
  classic: {
    id: 'classic',
    name: '古典风',
    description: '金色花纹、巴洛克风格、精致雕刻',
    cornerAsset: 'frames/classic/corner.svg',
    borderAsset: 'frames/classic/border.svg',
    cornerSize: 110,
    borderThickness: 25,
    insetOffset: 8,
    colorScheme: {
      primary: '#D4AF37',
      secondary: '#1A0F00',
      accent: '#FFD700',
    },
  },
  minimal: {
    id: 'minimal',
    name: '简约风',
    description: '细线条、现代感、低调优雅',
    cornerAsset: 'frames/minimal/corner.svg',
    borderAsset: 'frames/minimal/border.svg',
    cornerSize: 80,
    borderThickness: 15,
    insetOffset: 12,
    colorScheme: {
      primary: '#FFFFFF',
      secondary: '#333333',
      accent: '#888888',
    },
  },
  fantasy: {
    id: 'fantasy',
    name: '奇幻风',
    description: '魔法符文、藤蔓装饰、神秘光效',
    cornerAsset: 'frames/fantasy/corner.svg',
    borderAsset: 'frames/fantasy/border.svg',
    cornerSize: 105,
    borderThickness: 22,
    insetOffset: 10,
    colorScheme: {
      primary: '#9B59B6',
      secondary: '#1A0A2E',
      accent: '#00FF88',
    },
  },
  battle: {
    id: 'battle',
    name: '战场风',
    description: '铁锈质感、铆钉装饰、战损效果',
    cornerAsset: 'frames/battle/corner.svg',
    borderAsset: 'frames/battle/border.svg',
    cornerSize: 95,
    borderThickness: 24,
    insetOffset: 8,
    colorScheme: {
      primary: '#8B4513',
      secondary: '#2F2F2F',
      accent: '#CD853F',
    },
  },
  none: {
    id: 'none',
    name: '无边框',
    description: '不添加装饰边框',
    cornerAsset: '',
    borderAsset: '',
    cornerSize: 0,
    borderThickness: 0,
    insetOffset: 0,
    colorScheme: {
      primary: 'transparent',
      secondary: 'transparent',
      accent: 'transparent',
    },
  },
};

/**
 * 所有有效的边框预设ID列表
 */
export const VALID_PRESET_IDS: FramePresetId[] = [
  'cyber',
  'classic',
  'minimal',
  'fantasy',
  'battle',
  'none',
];

/**
 * 有装饰效果的预设ID列表（不包含 'none'）
 */
export const DECORATIVE_PRESET_IDS: FramePresetId[] = [
  'cyber',
  'classic',
  'minimal',
  'fantasy',
  'battle',
];

/**
 * 获取边框预设配置
 * 
 * @param presetId - 预设ID
 * @returns 预设配置，如果ID无效则返回 undefined
 */
export function getFramePreset(presetId: FramePresetId): FramePresetConfig | undefined {
  return FRAME_PRESETS[presetId];
}

/**
 * 验证预设ID是否有效
 * 
 * @param presetId - 待验证的预设ID
 * @returns 是否为有效的预设ID
 */
export function isValidPresetId(presetId: string): presetId is FramePresetId {
  return VALID_PRESET_IDS.includes(presetId as FramePresetId);
}

/**
 * 检查预设是否为装饰性预设（非 'none'）
 * 
 * @param presetId - 预设ID
 * @returns 是否为装饰性预设
 */
export function isDecorativePreset(presetId: FramePresetId): boolean {
  return presetId !== 'none';
}

/**
 * 获取所有预设的预览信息列表
 * 
 * @returns 预设预览信息数组
 */
export function getPresetPreviews(): Array<{
  id: FramePresetId;
  name: string;
  description: string;
}> {
  return VALID_PRESET_IDS.map((id) => ({
    id,
    name: FRAME_PRESETS[id].name,
    description: FRAME_PRESETS[id].description,
  }));
}

/**
 * 错误消息常量
 */
export const FRAME_ERROR_MESSAGES = {
  INVALID_PRESET: (id: string) =>
    `无效的边框预设 ID: ${id}，有效值为 cyber, classic, minimal, fantasy, battle, none`,
  ASSET_NOT_FOUND: (path: string) => `边框资源文件不存在: ${path}`,
  RENDER_FAILED: (detail: string) => `边框渲染失败: ${detail}`,
  CARD_DOWNLOAD_FAILED: (url: string) => `无法下载卡牌图片: ${url}`,
};
