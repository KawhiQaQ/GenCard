/**
 * Frame Types - 装饰边框系统类型定义
 * 
 * 本文件定义了卡牌装饰边框系统所需的所有类型和接口。
 * 
 * Requirements: 1.1, 1.2
 */

import { LayoutVariant } from './index';

/**
 * 边框预设ID类型
 * 
 * 定义可用的边框风格预设：
 * - 'cyber': 科技风 - 金属质感、发光线条、几何图案
 * - 'classic': 古典风 - 金色花纹、巴洛克风格、精致雕刻
 * - 'minimal': 简约风 - 细线条、现代感、低调优雅
 * - 'fantasy': 奇幻风 - 魔法符文、藤蔓装饰、神秘光效
 * - 'battle': 战场风 - 铁锈质感、铆钉装饰、战损效果
 * - 'none': 无边框 - 不添加装饰边框
 * 
 * Requirements: 1.1
 */
export type FramePresetId = 'cyber' | 'classic' | 'minimal' | 'fantasy' | 'battle' | 'none';

/**
 * 角落位置枚举
 * 
 * 定义四个角饰的位置
 * 
 * Requirements: 2.1
 */
export type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * 边框位置枚举
 * 
 * 定义四条边框条的位置
 * 
 * Requirements: 3.1
 */
export type BorderPosition = 'top' | 'right' | 'bottom' | 'left';

/**
 * 颜色方案接口
 * 
 * 定义边框预设的颜色配置
 */
export interface ColorScheme {
  /** 主色调 */
  primary: string;
  /** 辅助色 */
  secondary: string;
  /** 强调色 */
  accent: string;
}

/**
 * 边框预设配置接口
 * 
 * 定义单个边框预设的完整配置
 * 
 * Requirements: 1.1
 */
export interface FramePresetConfig {
  /** 预设ID */
  id: FramePresetId;
  /** 显示名称 */
  name: string;
  /** 风格描述 */
  description: string;
  /** 角饰资源路径 */
  cornerAsset: string;
  /** 边框条资源路径 */
  borderAsset: string;
  /** 角饰基础尺寸 (px) */
  cornerSize: number;
  /** 边框条厚度 (px) */
  borderThickness: number;
  /** 内嵌偏移量 (px) */
  insetOffset: number;
  /** 颜色方案 */
  colorScheme: ColorScheme;
}

/**
 * 边框渲染选项接口
 * 
 * 定义渲染边框时的配置参数
 * 
 * Requirements: 1.2, 6.5
 */
export interface FrameRenderOptions {
  /** 边框预设ID */
  presetId: FramePresetId;
  /** 卡牌宽度 */
  cardWidth: number;
  /** 卡牌高度 */
  cardHeight: number;
  /** 布局变体（可选） */
  layoutVariant?: LayoutVariant;
  /** 自定义内嵌偏移量（可选，覆盖预设值） */
  insetOffset?: number;
  /** 自定义边框厚度（可选，覆盖预设值） */
  borderThickness?: number;
}

/**
 * 边框渲染结果接口
 * 
 * 定义渲染完成后的返回数据
 * 
 * Requirements: 5.1
 */
export interface FrameRenderResult {
  /** 渲染后的图像缓冲区 */
  buffer: Buffer;
  /** 输出图像宽度 */
  width: number;
  /** 输出图像高度 */
  height: number;
}

/**
 * 角饰变换配置接口
 * 
 * 定义角饰在不同位置的镜像变换
 * 
 * Requirements: 2.3, 2.4, 2.5, 2.6
 */
export interface CornerTransform {
  /** 是否水平翻转 */
  flipHorizontal: boolean;
  /** 是否垂直翻转 */
  flipVertical: boolean;
}

/**
 * 位置坐标接口
 * 
 * 定义元素在画布上的位置
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 边框条尺寸接口
 * 
 * 定义边框条的位置和尺寸
 */
export interface BorderDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 应用边框请求接口
 * 
 * 定义 API 请求的数据结构
 * 
 * Requirements: 6.1, 6.5
 */
export interface ApplyFrameRequest {
  /** 卡牌图片 URL */
  cardImageUrl: string;
  /** 边框预设ID */
  framePresetId: FramePresetId;
  /** 布局变体 */
  layoutVariant: LayoutVariant;
  /** 自定义内嵌偏移量（可选） */
  insetOffset?: number;
  /** 自定义边框厚度（可选） */
  borderThickness?: number;
}

/**
 * 应用边框响应接口
 * 
 * 定义 API 响应的数据结构
 * 
 * Requirements: 6.1
 */
export interface ApplyFrameResponse {
  /** 是否成功 */
  success: boolean;
  /** 带边框的卡牌图片 URL（成功时返回） */
  imageUrl?: string;
  /** 错误信息（失败时返回） */
  error?: string;
}

/**
 * 角饰变换映射
 * 
 * 定义每个角落位置对应的变换配置
 * 
 * Requirements: 2.3, 2.4, 2.5, 2.6
 */
export const CORNER_TRANSFORMS: Record<CornerPosition, CornerTransform> = {
  'top-left': { flipHorizontal: false, flipVertical: false },
  'top-right': { flipHorizontal: true, flipVertical: false },
  'bottom-left': { flipHorizontal: false, flipVertical: true },
  'bottom-right': { flipHorizontal: true, flipVertical: true },
};
