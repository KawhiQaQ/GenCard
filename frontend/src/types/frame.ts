/**
 * Frame Types - 装饰边框系统前端类型定义
 * 
 * 本文件定义了卡牌装饰边框系统在前端所需的类型和接口。
 * 与后端类型保持同步。
 * 
 * Requirements: 1.1
 */

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
 * 定义单个边框预设的完整配置（前端简化版）
 * 
 * Requirements: 1.1
 */
export interface FramePreset {
  /** 预设ID */
  id: FramePresetId;
  /** 显示名称 */
  name: string;
  /** 风格描述 */
  description: string;
  /** 预览图路径 */
  previewImage: string;
  /** 颜色方案 */
  colorScheme: ColorScheme;
}

/**
 * 应用边框请求接口（前端发送）
 * 
 * Requirements: 6.1
 */
export interface ApplyFrameRequest {
  /** 卡牌图片 URL */
  cardImageUrl: string;
  /** 边框预设ID */
  framePresetId: FramePresetId;
  /** 布局变体 */
  layoutVariant: string;
  /** 自定义内嵌偏移量（可选） */
  insetOffset?: number;
  /** 自定义边框厚度（可选） */
  borderThickness?: number;
}

/**
 * 应用边框响应接口
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
