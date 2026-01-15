/**
 * Frame Presets - 边框预设配置常量
 * 
 * 本文件定义了所有可用的边框预设配置，与后端保持同步。
 * 
 * Requirements: 1.1, 1.4
 */

import { FramePresetId, FramePreset } from '../types/frame';

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
export const FRAME_PRESETS: Record<FramePresetId, FramePreset> = {
  cyber: {
    id: 'cyber',
    name: '科技风',
    description: '金属质感、发光线条、几何图案',
    previewImage: '/assets/frames/cyber/preview.png',
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
    previewImage: '/assets/frames/classic/preview.png',
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
    previewImage: '/assets/frames/minimal/preview.png',
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
    previewImage: '/assets/frames/fantasy/preview.png',
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
    previewImage: '/assets/frames/battle/preview.png',
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
    previewImage: '',
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
export function getFramePreset(presetId: FramePresetId): FramePreset | undefined {
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
 * 获取所有预设的预览信息列表（用于UI展示）
 * 
 * @returns 预设预览信息数组
 */
export function getPresetList(): FramePreset[] {
  return VALID_PRESET_IDS.map((id) => FRAME_PRESETS[id]);
}
