import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { TextBoxConfig, LayoutMode, LayoutVariant, CropAnchor, CropConfig } from '../types/index.js';
import {
  renderArtworkFrameBorder,
  renderTextBoxBorder,
  renderDoubleLineArtworkBorder,
  renderDoubleLineTextBoxBorder,
  renderAllDoubleLineBorders,
  BORDER_PRESETS,
  GlowIntensity,
  getGlowConfig,
  OuterGlowConfig,
  MIN_BORDER_GAP,
  calculateTotalBorderSpace,
  getArtworkBorderDimensions,
  getTextBoxBorderDimensions,
  validateBorderGap,
  validateBorderWithinCanvas
} from './borderRenderer.js';
import {
  TextureType,
  TextureConfig,
  TEXTURE_PRESETS,
  DEFAULT_TEXTURE_TYPE,
  getTextureConfig
} from './textureConfig.js';
import {
  GradientLightConfig,
  DEFAULT_GRADIENT_LIGHT,
  calculateGradientColors,
  generateSvgGradientDef
} from './gradientLightConfig.js';
import {
  BlurIntensity,
  BlurConfig,
  BLUR_PRESETS,
  DEFAULT_BLUR_INTENSITY,
  getBlurConfig
} from './blurConfig.js';
import {
  ScalePreset,
  ScaleConfig,
  SCALE_PRESETS,
  DEFAULT_SCALE_PRESET,
  getScaleConfig,
  isValidScalePreset,
  applyScaleFactor,
  applyScalePreset
} from './scaleConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 卡牌合成服务
 * 
 * 将背景图、原画、文本框和文字合成为最终卡牌
 * 支持横版（landscape）和竖版（portrait）两种布局模式
 */

// 文本框矩形配置接口
export interface TextBoxRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// 框架矩形配置接口
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 布局配置接口
export interface LayoutConfig {
  canvas: { width: number; height: number };
  artworkFrame: FrameRect;
  titleBox: TextBoxRect;
  contentBoxes: TextBoxRect[];  // 4个内容框
}

// 4选1布局变体配置
// 边框间隙计算 (Requirements: 2.1, 2.2, 2.3, 2.4, 2.6):
// - 原画框边框总宽度: 5 + 1.5 + 1.5 + 2 = 10px (不含外发光)
// - 文本框边框总宽度: 4 + 1 + 1 + 2 = 8px (不含外发光)
// - 外发光空间 (medium): blur(6) + spread(3) = 9px
// - 最小边框间隙: 2px
// - 原画框右边界到标题框左边界最小距离: 10 + 9 + 2 + 8 + 9 = 38px → 使用 50px (更宽松)
// - 文本框之间最小距离: 8 + 9 + 2 + 8 + 9 = 36px → 使用 50px (更宽松)
export const LAYOUT_VARIANTS: Record<LayoutVariant, LayoutConfig> = {
  // 横版方形 (1024x768) - 现有横版布局
  // 原画框右边界: 40 + 390 = 430
  // 标题框 x: 430 + 50 = 480
  // 边框间隙: 50px (比最小需求 38px 多 12px)
  // 标题框底部: 40 + 100 = 140
  // 内容框顶部: 140 + 50 = 190
  // 内容框高度: (728 - 190 - 50) / 2 = 244
  // 内容框垂直间距50px: y2=190+244+50=484
  // 内容框水平间距50px: 宽度=(504-50)/2=227, x2=480+227+50=757
  'landscape-square': {
    canvas: { width: 1024, height: 768 },
    artworkFrame: { x: 40, y: 40, width: 390, height: 688 },
    titleBox: { id: 'title', x: 480, y: 40, width: 504, height: 100 },
    contentBoxes: [
      { id: 'content1', x: 480, y: 190, width: 227, height: 244 },
      { id: 'content2', x: 757, y: 190, width: 227, height: 244 },
      { id: 'content3', x: 480, y: 484, width: 227, height: 244 },
      { id: 'content4', x: 757, y: 484, width: 227, height: 244 }
    ]
  },
  // 横版扁平 (1024x768) - 右半部分垂直居中
  // 原画框右边界: 40 + 390 = 430
  // 标题框 x: 480 (间隙 50px)
  // 内容总高度：标题框100 + 间距50 + 内容框160*2 + 间距50 = 520
  // 垂直居中起始Y：40 + (688 - 520) / 2 = 40 + 84 = 124
  // 内容框水平间距50px: 宽度=(504-50)/2=227, x2=480+227+50=757
  'landscape-flat': {
    canvas: { width: 1024, height: 768 },
    artworkFrame: { x: 40, y: 40, width: 390, height: 688 },
    titleBox: { id: 'title', x: 480, y: 124, width: 504, height: 100 },
    contentBoxes: [
      { id: 'content1', x: 480, y: 274, width: 227, height: 160 },
      { id: 'content2', x: 757, y: 274, width: 227, height: 160 },
      { id: 'content3', x: 480, y: 484, width: 227, height: 160 },
      { id: 'content4', x: 757, y: 484, width: 227, height: 160 }
    ]
  },
  // 竖版方形 (768x1024) - 原画框为正方形，适配正方形原画
  // 画布宽度 768px，原画框宽度 480px，居中放置
  // 原画框 x: (768 - 480) / 2 = 144
  // 原画框下边界: 40 + 480 = 520
  // 标题框 y: 520 + 50 = 570 (间隙 50px，与横版一致)
  // 标题框底部: 570 + 70 = 640
  // 内容框顶部: 640 + 50 = 690
  // 内容框水平间距50px: 宽度=(480-50)/2=215, x2=144+215+50=409
  // 内容框垂直间距50px
  'portrait-square': {
    canvas: { width: 768, height: 1024 },
    artworkFrame: { x: 144, y: 40, width: 480, height: 480 },
    titleBox: { id: 'title', x: 144, y: 570, width: 480, height: 70 },
    contentBoxes: [
      { id: 'content1', x: 144, y: 690, width: 215, height: 130 },
      { id: 'content2', x: 409, y: 690, width: 215, height: 130 },
      { id: 'content3', x: 144, y: 870, width: 215, height: 110 },
      { id: 'content4', x: 409, y: 870, width: 215, height: 110 }
    ]
  },
  // 竖版扁平 (768x1024) - 原画框为正方形，内容框高度缩减
  // 原画框 x: (768 - 480) / 2 = 144
  // 原画框下边界: 40 + 480 = 520
  // 标题框 y: 520 + 50 = 570 (间隙 50px，与横版一致)
  // 内容框水平间距50px: 宽度=(480-50)/2=215, x2=144+215+50=409
  // 内容框垂直间距50px
  'portrait-flat': {
    canvas: { width: 768, height: 1024 },
    artworkFrame: { x: 144, y: 40, width: 480, height: 480 },
    titleBox: { id: 'title', x: 144, y: 570, width: 480, height: 70 },
    contentBoxes: [
      { id: 'content1', x: 144, y: 690, width: 215, height: 90 },
      { id: 'content2', x: 409, y: 690, width: 215, height: 90 },
      { id: 'content3', x: 144, y: 830, width: 215, height: 90 },
      { id: 'content4', x: 409, y: 830, width: 215, height: 90 }
    ]
  }
};

// 横版布局配置 (1024x768) - 向后兼容别名
export const LANDSCAPE_LAYOUT: LayoutConfig = LAYOUT_VARIANTS['landscape-square'];

// 竖版布局配置 (768x1024) - 向后兼容别名
export const PORTRAIT_LAYOUT: LayoutConfig = LAYOUT_VARIANTS['portrait-square'];

/**
 * 根据布局模式获取配置（向后兼容）
 * @param mode - 布局模式
 * @returns 布局配置
 */
export function getLayoutConfig(mode: LayoutMode): LayoutConfig {
  return mode === 'landscape' ? LANDSCAPE_LAYOUT : PORTRAIT_LAYOUT;
}

/**
 * 根据布局变体获取配置（新API，支持4选1）
 * @param variant - 布局变体
 * @returns 布局配置
 */
export function getLayoutConfigByVariant(variant: LayoutVariant): LayoutConfig {
  return LAYOUT_VARIANTS[variant];
}

/**
 * 从布局变体获取布局模式（用于向后兼容）
 * @param variant - 布局变体
 * @returns 布局模式
 */
export function getLayoutModeFromVariant(variant: LayoutVariant): LayoutMode {
  return variant.startsWith('landscape') ? 'landscape' : 'portrait';
}

/**
 * 根据布局模式获取默认裁剪锚点
 * 
 * 竖版布局使用 'top' 锚点，优先保留原画上部区域（人物头部和上半身）
 * 横版布局使用 'center' 锚点，保持居中裁剪（现有行为）
 * 
 * Requirements: 3.4, 3.5
 * 
 * @param layoutMode - 布局模式 ('landscape' | 'portrait')
 * @returns 默认裁剪锚点
 */
export function getDefaultCropAnchor(layoutMode: LayoutMode): CropAnchor {
  return layoutMode === 'portrait' ? 'top' : 'center';
}

/**
 * 将裁剪锚点映射到 Sharp 的 position 参数
 * 
 * Sharp 支持的 position 值：
 * - 字符串: 'top', 'right top', 'right', 'right bottom', 'bottom', 'left bottom', 'left', 'left top', 'center', 'centre'
 * - sharp.position 枚举: top, rightTop, right, rightBottom, bottom, leftBottom, left, leftTop
 * - sharp.gravity 枚举: north, northeast, east, southeast, south, southwest, west, northwest, center, centre
 * 
 * Requirements: 3.3
 * 
 * @param anchor - 裁剪锚点
 * @returns Sharp resize position 参数
 */
export function getCropPosition(anchor: CropAnchor): string {
  // 使用 sharp.gravity 风格的值，更明确
  const positionMap: Record<CropAnchor, string> = {
    'top': 'north',      // 顶部对齐，保留图像上部
    'center': 'centre',  // 居中对齐
    'bottom': 'south'    // 底部对齐，保留图像下部
  };
  return positionMap[anchor];
}

/**
 * 缩放裁剪原画
 * 
 * 横版和竖版布局统一使用标准的 cover fit 处理：
 * - 横版原画 (720x1280) 适配横版原画框 (390x688)
 * - 竖版原画 (1024x1024) 适配竖版原画框 (600x480)
 * 
 * 两种布局的原画尺寸都已经与原画框比例适配，使用 cover fit 即可。
 * 
 * @param artworkBuffer - 原画 Buffer
 * @param targetWidth - 目标宽度
 * @param targetHeight - 目标高度
 * @param layoutMode - 布局模式
 * @param cropAnchor - 裁剪锚点
 * @returns 缩放裁剪后的原画 Buffer
 */
export async function resizeAndCropArtwork(
  artworkBuffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  layoutMode: LayoutMode,
  cropAnchor: CropAnchor
): Promise<Buffer> {
  const metadata = await sharp(artworkBuffer).metadata();
  const srcWidth = metadata.width!;
  const srcHeight = metadata.height!;
  
  const srcAspect = srcWidth / srcHeight;
  const targetAspect = targetWidth / targetHeight;
  
  console.log('=== 缩放裁剪原画 ===');
  console.log('原画尺寸:', srcWidth, 'x', srcHeight, '宽高比:', srcAspect.toFixed(3));
  console.log('目标尺寸:', targetWidth, 'x', targetHeight, '宽高比:', targetAspect.toFixed(3));
  console.log('布局模式:', layoutMode, '裁剪锚点:', cropAnchor);
  
  // 横版和竖版布局统一使用标准的 cover fit
  console.log('策略: 标准 cover fit');
  const cropPosition = getCropPosition(cropAnchor);
  
  return sharp(artworkBuffer)
    .resize(targetWidth, targetHeight, {
      fit: 'cover',
      position: cropPosition
    })
    .png()
    .toBuffer();
}

/**
 * 获取所有文本框（标题框 + 内容框）
 * @param layout - 布局配置
 * @returns 所有文本框数组
 */
export function getAllTextBoxes(layout: LayoutConfig): TextBoxRect[] {
  return [layout.titleBox, ...layout.contentBoxes];
}

/**
 * 验证布局配置中所有边框是否在画布边界内
 * 
 * Requirements: 2.5
 * 
 * @param layout - 布局配置
 * @param glowConfig - 可选的外发光配置
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validateLayoutBorders(
  layout: LayoutConfig,
  glowConfig?: OuterGlowConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { canvas, artworkFrame, titleBox, contentBoxes } = layout;
  
  // 获取边框尺寸配置
  const artworkBorderDims = getArtworkBorderDimensions(glowConfig);
  const textBoxBorderDims = getTextBoxBorderDimensions(glowConfig);
  
  // 验证原画框边框是否在画布内
  if (!validateBorderWithinCanvas(artworkFrame, artworkBorderDims, canvas.width, canvas.height)) {
    errors.push(`原画框边框超出画布边界`);
  }
  
  // 验证标题框边框是否在画布内
  if (!validateBorderWithinCanvas(titleBox, textBoxBorderDims, canvas.width, canvas.height)) {
    errors.push(`标题框边框超出画布边界`);
  }
  
  // 验证所有内容框边框是否在画布内
  for (let i = 0; i < contentBoxes.length; i++) {
    if (!validateBorderWithinCanvas(contentBoxes[i], textBoxBorderDims, canvas.width, canvas.height)) {
      errors.push(`内容框 ${i + 1} 边框超出画布边界`);
    }
  }
  
  // 验证原画框与标题框之间的间隙
  if (!validateBorderGap(artworkFrame, titleBox, artworkBorderDims, textBoxBorderDims, MIN_BORDER_GAP)) {
    errors.push(`原画框与标题框边框间隙不足 ${MIN_BORDER_GAP}px`);
  }
  
  // 验证标题框与内容框之间的间隙
  for (let i = 0; i < contentBoxes.length; i++) {
    if (!validateBorderGap(titleBox, contentBoxes[i], textBoxBorderDims, textBoxBorderDims, MIN_BORDER_GAP)) {
      errors.push(`标题框与内容框 ${i + 1} 边框间隙不足 ${MIN_BORDER_GAP}px`);
    }
  }
  
  // 验证相邻内容框之间的间隙
  for (let i = 0; i < contentBoxes.length; i++) {
    for (let j = i + 1; j < contentBoxes.length; j++) {
      if (!validateBorderGap(contentBoxes[i], contentBoxes[j], textBoxBorderDims, textBoxBorderDims, MIN_BORDER_GAP)) {
        errors.push(`内容框 ${i + 1} 与内容框 ${j + 1} 边框间隙不足 ${MIN_BORDER_GAP}px`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 兼容旧版 CARD_LAYOUT（使用横版布局）
export const CARD_LAYOUT = {
  canvas: LANDSCAPE_LAYOUT.canvas,
  artworkFrame: LANDSCAPE_LAYOUT.artworkFrame,
  textBoxes: getAllTextBoxes(LANDSCAPE_LAYOUT)
} as const;

// 文本框质感底色样式
export const PREMIUM_TEXTBOX_STYLE = {
  backgroundColor: 'rgba(20, 20, 25, 0.85)',
  borderColor: '#8B7355',
  borderWidth: 3,
  borderRadius: 10  // 圆角半径
};

// Premium 底色选项（带渐变纹理）- 与前端保持一致
export const PREMIUM_TEXTBOX_COLORS = [
  { 
    id: 'obsidian', 
    name: '黑曜石', 
    gradient: ['rgba(35, 35, 40, 0.92)', 'rgba(20, 20, 25, 0.88)', 'rgba(25, 25, 30, 0.92)']
  },
  { 
    id: 'bronze', 
    name: '古铜', 
    gradient: ['rgba(160, 130, 90, 0.92)', 'rgba(140, 110, 70, 0.88)', 'rgba(150, 120, 80, 0.92)']
  },
  { 
    id: 'slate', 
    name: '石板灰', 
    gradient: ['rgba(80, 90, 100, 0.92)', 'rgba(60, 70, 80, 0.88)', 'rgba(70, 80, 90, 0.92)']
  },
  { 
    id: 'burgundy', 
    name: '勃艮第红', 
    gradient: ['rgba(120, 50, 60, 0.92)', 'rgba(100, 40, 50, 0.88)', 'rgba(110, 45, 55, 0.92)']
  },
  { 
    id: 'forest', 
    name: '森林绿', 
    gradient: ['rgba(50, 80, 60, 0.92)', 'rgba(40, 70, 50, 0.88)', 'rgba(45, 75, 55, 0.92)']
  },
  { 
    id: 'navy', 
    name: '海军蓝', 
    gradient: ['rgba(45, 60, 90, 0.92)', 'rgba(35, 50, 80, 0.88)', 'rgba(40, 55, 85, 0.92)']
  }
] as const;

// 底色 ID 类型
export type PremiumColorId = typeof PREMIUM_TEXTBOX_COLORS[number]['id'];

// 重新导出纹理类型供外部使用
export type { TextureType, TextureConfig } from './textureConfig.js';
export { TEXTURE_PRESETS, DEFAULT_TEXTURE_TYPE, getTextureConfig } from './textureConfig.js';

// 重新导出渐变光照配置供外部使用
export type { GradientLightConfig } from './gradientLightConfig.js';
export { DEFAULT_GRADIENT_LIGHT, calculateGradientColors, generateSvgGradientDef } from './gradientLightConfig.js';

// 重新导出模糊配置供外部使用 (Requirements: 3.1, 3.2)
export type { BlurIntensity, BlurConfig } from './blurConfig.js';
export { BLUR_PRESETS, DEFAULT_BLUR_INTENSITY, getBlurConfig, isValidBlurIntensity } from './blurConfig.js';

// 重新导出缩放配置供外部使用 (Requirements: 7.1, 7.2, 7.3, 7.4, 7.5)
export type { ScalePreset, ScaleConfig } from './scaleConfig.js';
export { 
  SCALE_PRESETS, 
  DEFAULT_SCALE_PRESET, 
  getScaleConfig, 
  isValidScalePreset, 
  applyScaleFactor, 
  applyScalePreset,
  getScalePresetOptions
} from './scaleConfig.js';

// 重新导出边框配置供外部使用 (Requirements: 2.4, 2.5, 2.6)
export type { BorderDimensions } from './borderRenderer.js';
export {
  MIN_BORDER_GAP,
  calculateTotalBorderSpace,
  getArtworkBorderDimensions,
  getTextBoxBorderDimensions,
  validateBorderGap,
  validateBorderWithinCanvas
} from './borderRenderer.js';

// 重新导出裁剪配置类型供外部使用 (Requirements: 3.3)
export type { CropAnchor, CropConfig } from '../types/index.js';

/**
 * 根据底色 ID 获取渐变色配置
 * @param colorId - 底色 ID
 * @returns 渐变色数组，默认返回黑曜石
 */
export function getTextBoxColorGradient(colorId: string): string[] {
  const color = PREMIUM_TEXTBOX_COLORS.find(c => c.id === colorId);
  return color ? [...color.gradient] : [...PREMIUM_TEXTBOX_COLORS[0].gradient];
}

// 卡牌字体样式 - 更新字体大小配置
export const CARD_FONT_STYLE = {
  fontFamily: 'serif',
  title: {
    fontSize: 48,           // 标题字体大小（从40px增大到48px）
    fontWeight: 'bold',
    lineHeight: 1.3
  },
  content: {
    fontSize: 36,           // 内容字体大小（从30px增大到36px）
    fontWeight: 'bold',
    lineHeight: 1.4
  },
  minFontSize: 24,          // 最小字体大小（从20px增大到24px）
  color: '#FFFFFF',
  shadowColor: 'rgba(0, 0, 0, 0.8)',
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  shadowBlur: 2
};

/**
 * 卡牌合成选项
 */
export interface ComposeCardOptions {
  backgroundBuffer: Buffer;      // 背景图
  artworkBuffer: Buffer;         // 原画
  textBoxes: TextBoxConfig[];    // 文本框配置（含文字）
  textBoxColorId?: string;       // 文本框底色 ID（可选，默认 obsidian）
  layoutMode?: LayoutMode;       // 布局模式（可选，默认 landscape）- 向后兼容
  layoutVariant?: LayoutVariant; // 布局变体（可选，优先于 layoutMode）- Requirements: 1.2
  borderPreset?: 'gold' | 'silver' | 'bronze';  // 边框预设（可选）
  textureType?: TextureType;     // 纹理类型（可选，默认 matte-paper）
  blurIntensity?: BlurIntensity; // 模糊强度（可选，默认 medium）- Requirements: 3.1, 3.2
  glowIntensity?: GlowIntensity; // 外发光强度（可选，默认 medium）- Requirements: 5.1, 5.3
  scalePreset?: ScalePreset;     // 缩放预设（可选，默认 standard）- Requirements: 7.5
  cropAnchor?: CropAnchor;       // 裁剪锚点（可选，默认根据布局模式自动选择）- Requirements: 3.3
}

/**
 * 合成最终卡牌
 * 
 * 流程：
 * 1. 背景图作为底图
 * 2. 原画缩放放置到原画框位置
 * 3. 绘制原画框边框
 * 4. 绘制文本框底色和边框
 * 5. 渲染文字
 * 
 * @param options - 合成选项
 * @returns 合成后的卡牌图像 Buffer
 */
export async function composeCard(options: ComposeCardOptions): Promise<Buffer> {
  const { 
    backgroundBuffer, 
    artworkBuffer, 
    textBoxes, 
    textBoxColorId, 
    layoutMode = 'landscape',
    layoutVariant,
    borderPreset, 
    textureType, 
    blurIntensity,
    glowIntensity,
    scalePreset,
    cropAnchor
  } = options;
  
  // 优先使用 layoutVariant 获取布局配置，否则回退到 layoutMode（向后兼容）
  // Requirements: 1.2, 1.3
  let layout = layoutVariant 
    ? getLayoutConfigByVariant(layoutVariant)
    : getLayoutConfig(layoutMode);
  
  // 确定实际使用的布局模式（用于裁剪锚点计算）
  // Requirements: 3.1, 3.2, 3.6
  const effectiveLayoutMode = layoutVariant 
    ? getLayoutModeFromVariant(layoutVariant)
    : layoutMode;
  
  // 确定裁剪锚点：优先使用用户指定的锚点，否则根据布局模式自动选择
  // Requirements: 3.3, 3.4, 3.5, 3.6
  // 竖版布局强制使用 'top' 锚点，确保保留人物头部
  const effectiveCropAnchor = cropAnchor || getDefaultCropAnchor(effectiveLayoutMode);
  
  // 调试日志：确认裁剪锚点选择
  console.log('=== 裁剪锚点调试 ===');
  console.log('layoutVariant:', layoutVariant);
  console.log('layoutMode:', layoutMode);
  console.log('effectiveLayoutMode:', effectiveLayoutMode);
  console.log('cropAnchor (用户指定):', cropAnchor);
  console.log('effectiveCropAnchor (最终使用):', effectiveCropAnchor);
  console.log('getDefaultCropAnchor(effectiveLayoutMode):', getDefaultCropAnchor(effectiveLayoutMode));
  
  // 应用缩放预设（Requirements: 7.1, 7.2, 7.3, 7.4, 7.5）
  if (scalePreset && scalePreset !== 'standard') {
    layout = applyScalePreset(layout, scalePreset);
  }
  
  const allTextBoxes = getAllTextBoxes(layout);
  
  // 获取外发光配置（Requirements: 5.1, 5.3）
  const glowConfig = glowIntensity ? getGlowConfig(glowIntensity) : undefined;
  
  // 验证布局边框配置（Requirements: 2.5）
  const layoutValidation = validateLayoutBorders(layout, glowConfig);
  if (!layoutValidation.valid) {
    console.warn('布局边框验证警告:', layoutValidation.errors);
  }
  
  console.log('=== 开始卡牌合成 ===');
  console.log('布局变体:', layoutVariant || '未指定');
  console.log('布局模式:', layoutMode, layoutVariant ? '(已被 layoutVariant 覆盖)' : '');
  console.log('实际布局模式:', effectiveLayoutMode);
  console.log('画布尺寸:', layout.canvas.width, 'x', layout.canvas.height);
  console.log('原画 Buffer 大小:', artworkBuffer.length, 'bytes');
  console.log('背景 Buffer 大小:', backgroundBuffer.length, 'bytes');
  console.log('文本框底色 ID:', textBoxColorId || 'obsidian (默认)');
  console.log('纹理类型:', textureType || 'matte-paper (默认)');
  console.log('模糊强度:', blurIntensity || 'medium (默认)');
  console.log('外发光强度:', glowIntensity || 'medium (默认)');
  console.log('缩放预设:', scalePreset || 'standard (默认)');
  console.log('裁剪锚点:', effectiveCropAnchor, cropAnchor ? '(用户指定)' : '(自动选择)');
  console.log('边框预设:', borderPreset || '默认');
  console.log('文本框数量:', allTextBoxes.length);
  console.log('布局边框验证:', layoutValidation.valid ? '通过' : '有警告');
  
  // 验证原画 Buffer
  if (!artworkBuffer || artworkBuffer.length === 0) {
    throw new Error('原画图像数据为空');
  }
  
  // 1. 使用背景图作为底图（根据布局模式调整画布尺寸）
  let compositeImage = sharp(backgroundBuffer)
    .resize(layout.canvas.width, layout.canvas.height, {
      fit: 'cover',
      position: 'center'
    });
  
  // 获取背景图 Buffer
  let resultBuffer = await compositeImage.png().toBuffer();
  console.log('背景图处理完成');
  
  // 2. 原画缩放并放置到原画框位置（根据布局模式使用对应的原画框配置）
  const artworkFrame = layout.artworkFrame;
  
  // 获取原画元数据以验证图像有效性
  const artworkMetadata = await sharp(artworkBuffer).metadata();
  console.log('原画元数据:', {
    width: artworkMetadata.width,
    height: artworkMetadata.height,
    format: artworkMetadata.format,
    channels: artworkMetadata.channels
  });
  
  if (!artworkMetadata.width || !artworkMetadata.height) {
    throw new Error('无法读取原画图像尺寸');
  }
  
  // 使用智能缩放裁剪函数处理原画
  // 解决竖版布局 + 宽图时 top 锚点不生效的问题
  const resizedArtwork = await resizeAndCropArtwork(
    artworkBuffer,
    artworkFrame.width,
    artworkFrame.height,
    effectiveLayoutMode,
    effectiveCropAnchor
  );
  
  console.log('原画缩放完成，缩放后大小:', resizedArtwork.length, 'bytes');
  
  // 验证缩放后的原画
  const resizedMetadata = await sharp(resizedArtwork).metadata();
  console.log('缩放后原画尺寸:', resizedMetadata.width, 'x', resizedMetadata.height);
  
  resultBuffer = await sharp(resultBuffer)
    .composite([{
      input: resizedArtwork,
      left: artworkFrame.x,
      top: artworkFrame.y
    }])
    .png()
    .toBuffer();
  console.log('原画放置完成，位置: (', artworkFrame.x, ',', artworkFrame.y, ')');
  
  // 3. 绘制原画框边框（使用双线边框和外发光效果）- Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4
  const artworkBorder = await renderDoubleLineArtworkBorder(artworkFrame, undefined, glowConfig);
  resultBuffer = await sharp(resultBuffer)
    .composite([{
      input: artworkBorder.buffer,
      left: Math.max(0, artworkBorder.x),
      top: Math.max(0, artworkBorder.y)
    }])
    .png()
    .toBuffer();
  console.log('原画框边框渲染完成');
  
  // 4. 绘制文本框底色和边框（使用指定的底色、布局配置、边框预设、纹理类型、模糊强度和外发光配置）
  resultBuffer = await renderTextBoxBackgrounds(resultBuffer, textBoxes, textBoxColorId, layout, borderPreset, textureType, blurIntensity, glowConfig);
  console.log('文本框底色和边框渲染完成');
  
  // 5. 渲染文字（使用布局配置）
  resultBuffer = await renderTextContent(resultBuffer, textBoxes, layout);
  console.log('文字渲染完成');
  
  console.log('=== 卡牌合成完成 ===');
  return resultBuffer;
}


/**
 * 渲染文本框底色和边框
 * 支持5个文本框（1标题 + 4内容）的新布局
 * 
 * @param baseBuffer - 基础图像 Buffer
 * @param textBoxes - 文本框配置数组
 * @param textBoxColorId - 文本框底色 ID（可选，默认 obsidian）
 * @param layout - 布局配置（可选，默认使用横版布局）
 * @param borderPreset - 边框预设（可选）
 * @param textureType - 纹理类型（可选，默认 matte-paper）
 * @param blurIntensity - 模糊强度（可选，默认 medium）
 * @param glowConfig - 外发光配置（可选）
 * @returns 渲染后的图像 Buffer
 */
async function renderTextBoxBackgrounds(
  baseBuffer: Buffer,
  textBoxes: TextBoxConfig[],
  textBoxColorId?: string,
  layout?: LayoutConfig,
  borderPreset?: 'gold' | 'silver' | 'bronze',
  textureType?: TextureType,
  blurIntensity?: BlurIntensity,
  glowConfig?: { blur: number; color: string; opacity: number; spread: number }
): Promise<Buffer> {
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  
  // 获取指定底色的渐变色配置
  const gradientColors = getTextBoxColorGradient(textBoxColorId || 'obsidian');
  
  // 获取纹理配置
  const texture = getTextureConfig(textureType || DEFAULT_TEXTURE_TYPE);
  
  // 获取模糊配置 (Requirements: 3.1, 3.2)
  const blur = getBlurConfig(blurIntensity || DEFAULT_BLUR_INTENSITY);
  
  // 使用传入的布局配置或默认横版布局
  const currentLayout = layout || LANDSCAPE_LAYOUT;
  const allTextBoxes = getAllTextBoxes(currentLayout);
  
  // 获取预设样式（如果指定）
  const presetStyle = borderPreset ? {
    gradientColors: BORDER_PRESETS[borderPreset].gradientColors as unknown as string[],
    highlightColor: BORDER_PRESETS[borderPreset].highlightColor
  } : undefined;
  
  for (let i = 0; i < allTextBoxes.length; i++) {
    const layoutBox = allTextBoxes[i];
    
    // 创建文本框底色（质感半透明 + 渐变效果 + 自定义颜色 + 纹理叠加 + 毛玻璃模糊）
    const backgroundSvg = createTextBoxBackgroundSvg(
      layoutBox.width, 
      layoutBox.height,
      gradientColors,
      texture,
      undefined,  // gradientLightConfig - use default
      blur        // blurConfig
    );
    const backgroundBuffer = await sharp(Buffer.from(backgroundSvg))
      .png()
      .toBuffer();
    
    composites.push({
      input: backgroundBuffer,
      left: layoutBox.x,
      top: layoutBox.y
    });
    
    // 渲染文本框边框（使用双线边框和外发光效果）- Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4
    const border = await renderDoubleLineTextBoxBorder(layoutBox, undefined, `textbox${i}`, glowConfig);
    composites.push({
      input: border.buffer,
      left: Math.max(0, border.x),
      top: Math.max(0, border.y)
    });
  }
  
  return sharp(baseBuffer)
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * 创建文本框底色 SVG（带质感效果、圆角、纹理叠加、渐变光照和毛玻璃模糊）
 * 支持自定义渐变色配置、纹理类型、渐变光照效果和毛玻璃模糊效果
 * 
 * 纹理与颜色独立优化 (Requirements: 1.1, 1.2, 1.3, 1.5):
 * - 底色渐变层使用用户选择的颜色，不受纹理类型影响
 * - 纹理叠加层使用中性色（白/黑）和 overlay 混合模式
 * - 纹理仅添加质感效果，不改变底色的色相和饱和度
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4
 * 
 * @param width - 宽度
 * @param height - 高度
 * @param gradientColors - 可选的渐变色数组（3个颜色：顶部、中间、底部）
 * @param textureConfig - 可选的纹理配置
 * @param gradientLightConfig - 可选的渐变光照配置
 * @param blurConfig - 可选的毛玻璃模糊配置
 * @returns SVG 字符串
 */
function createTextBoxBackgroundSvg(
  width: number, 
  height: number,
  gradientColors?: string[],
  textureConfig?: TextureConfig,
  gradientLightConfig?: GradientLightConfig,
  blurConfig?: BlurConfig
): string {
  const borderRadius = PREMIUM_TEXTBOX_STYLE.borderRadius;
  
  // 使用自定义渐变色或默认黑曜石渐变
  // 底色渲染独立于纹理类型 (Requirements: 1.1, 1.2, 1.3)
  const baseColors = gradientColors && gradientColors.length >= 3 
    ? gradientColors 
    : [...PREMIUM_TEXTBOX_COLORS[0].gradient];
  
  // 应用渐变光照效果（Requirements: 2.1, 2.2, 2.3, 2.4）
  // 使用中间颜色作为基础色，计算带光照效果的渐变色
  const lightConfig = gradientLightConfig || DEFAULT_GRADIENT_LIGHT;
  const baseColor = baseColors[1] || baseColors[0]; // 使用中间色或第一个颜色作为基础
  const lightedColors = calculateGradientColors(baseColor, lightConfig);
  
  // 生成渐变定义（使用光照效果后的颜色，独立于纹理）
  const gradientDef = generateSvgGradientDef('bgGradient', lightedColors, 'vertical');
  
  // 获取纹理配置，默认使用磨砂黑纸
  const texture = textureConfig || TEXTURE_PRESETS['matte-paper'];
  
  // 生成纹理 pattern 定义（使用中性色，不影响底色色相）
  const texturePatternDef = generateTexturePattern(texture);
  
  // 获取模糊配置，默认使用中度模糊 (Requirements: 3.1, 3.2)
  const blur = blurConfig || BLUR_PRESETS['medium'];
  
  // 纹理叠加层（仅当纹理类型不为 none 时渲染）
  // 使用 overlay 混合模式，确保纹理不改变底色的色相和饱和度 (Requirements: 1.5)
  const textureOverlay = texture.pattern !== 'none' 
    ? `<rect width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" fill="url(#texturePattern)" opacity="${texture.opacity}" style="mix-blend-mode: overlay;"/>`
    : '';
  
  // 毛玻璃模糊滤镜定义 (Requirements: 3.1, 3.2, 3.3, 3.4)
  // 使用 feGaussianBlur 模拟 backdrop-filter blur 效果
  const blurFilterDef = `
        <!-- 毛玻璃模糊滤镜 (blur: ${blur.blur}px) -->
        <filter id="backdropBlur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${blur.blur / 2}" result="blur"/>
          <feColorMatrix in="blur" type="matrix" 
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 ${blur.opacity} 0" result="blurWithOpacity"/>
        </filter>`;
  
  // 毛玻璃效果层 - 半透明背景模拟毛玻璃效果 (Requirements: 3.3, 3.4)
  // 透明度范围 0.75-0.90，根据 blur.opacity 配置
  const frostedGlassLayer = `
      <!-- 毛玻璃效果层 (opacity: ${blur.opacity}) -->
      <rect width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" 
        fill="rgba(255,255,255,0.03)" filter="url(#backdropBlur)"/>`;
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${gradientDef}
        ${texturePatternDef}
        ${blurFilterDef}
        <!-- 内阴影滤镜增强立体感 -->
        <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
          <feOffset in="blur" dx="2" dy="2" result="offsetBlur"/>
          <feComposite in="SourceGraphic" in2="offsetBlur" operator="over"/>
        </filter>
        <!-- 高光效果 -->
        <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.08)"/>
          <stop offset="50%" style="stop-color:rgba(255,255,255,0.02)"/>
          <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      <!-- 底色背景（带圆角和渐变光照效果）- 独立于纹理渲染 (Requirements: 1.1, 1.2, 1.3) -->
      <rect width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" fill="url(#bgGradient)" filter="url(#innerShadow)" opacity="${blur.opacity}"/>
      ${frostedGlassLayer}
      <!-- 纹理叠加层 - 使用中性色和 overlay 混合模式 (Requirements: 1.5) -->
      ${textureOverlay}
      <!-- 高光叠加层 -->
      <rect width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" fill="url(#highlightGradient)"/>
    </svg>
  `;
}

/**
 * 生成纹理 pattern SVG 定义
 * 支持三种纹理类型：磨砂黑纸(noise)、深色丝绸(diagonal-lines)、水墨晕染(cloud)
 * 
 * 纹理与颜色独立优化 (Requirements: 1.5):
 * - 纹理图案使用纯中性色（白色/黑色）
 * - 通过透明度控制纹理强度
 * - 确保纹理不改变底色的色相和饱和度
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 * 
 * @param texture - 纹理配置
 * @returns SVG pattern 定义字符串
 */
function generateTexturePattern(texture: TextureConfig): string {
  const scale = texture.scale;
  
  // 中性色定义 - 纯白和纯黑，通过透明度控制强度 (Requirements: 1.5)
  // 使用较低的透明度确保纹理仅添加质感，不影响底色色相
  const lightNeutral = 'rgba(255,255,255,0.15)';  // 白色高光
  const darkNeutral = 'rgba(0,0,0,0.15)';         // 黑色阴影
  const lightNeutralSoft = 'rgba(255,255,255,0.10)';
  const darkNeutralSoft = 'rgba(0,0,0,0.12)';
  const lightNeutralSubtle = 'rgba(255,255,255,0.08)';
  const darkNeutralSubtle = 'rgba(0,0,0,0.10)';
  
  switch (texture.pattern) {
    case 'noise':
      // 磨砂黑纸质感 - 细密噪点纹理
      // 使用纯中性色（白/黑）创建噪点效果 (Requirements: 1.5)
      const noiseSize = Math.round(8 * scale);
      return `
        <pattern id="texturePattern" patternUnits="userSpaceOnUse" width="${noiseSize}" height="${noiseSize}">
          <rect width="${noiseSize}" height="${noiseSize}" fill="transparent"/>
          <circle cx="${1 * scale}" cy="${1 * scale}" r="${0.8 * scale}" fill="${lightNeutral}"/>
          <circle cx="${5 * scale}" cy="${2 * scale}" r="${0.6 * scale}" fill="${darkNeutral}"/>
          <circle cx="${3 * scale}" cy="${4 * scale}" r="${0.7 * scale}" fill="${lightNeutralSoft}"/>
          <circle cx="${7 * scale}" cy="${6 * scale}" r="${0.5 * scale}" fill="${darkNeutralSoft}"/>
          <circle cx="${2 * scale}" cy="${7 * scale}" r="${0.4 * scale}" fill="${lightNeutralSubtle}"/>
          <circle cx="${6 * scale}" cy="${4 * scale}" r="${0.55 * scale}" fill="${darkNeutralSubtle}"/>
        </pattern>
      `;
    
    case 'diagonal-lines':
      // 深色丝绸纹理 - 斜线纹理
      // 使用纯中性色（白/黑）创建丝绸光泽效果 (Requirements: 1.5)
      const lineSize = Math.round(6 * scale);
      return `
        <pattern id="texturePattern" patternUnits="userSpaceOnUse" width="${lineSize}" height="${lineSize}" patternTransform="rotate(45)">
          <rect width="${lineSize}" height="${lineSize}" fill="transparent"/>
          <line x1="0" y1="0" x2="0" y2="${lineSize}" stroke="${lightNeutralSoft}" stroke-width="${0.5 * scale}"/>
          <line x1="${lineSize / 2}" y1="0" x2="${lineSize / 2}" y2="${lineSize}" stroke="${darkNeutralSoft}" stroke-width="${0.3 * scale}"/>
        </pattern>
      `;
    
    case 'cloud':
      // 水墨晕染效果 - 云状纹理
      // 使用纯中性色（白/黑）创建水墨晕染效果 (Requirements: 1.5)
      const cloudSize = Math.round(20 * scale);
      return `
        <pattern id="texturePattern" patternUnits="userSpaceOnUse" width="${cloudSize}" height="${cloudSize}">
          <rect width="${cloudSize}" height="${cloudSize}" fill="transparent"/>
          <ellipse cx="${5 * scale}" cy="${5 * scale}" rx="${4 * scale}" ry="${3 * scale}" fill="${lightNeutralSubtle}"/>
          <ellipse cx="${15 * scale}" cy="${8 * scale}" rx="${5 * scale}" ry="${4 * scale}" fill="${darkNeutralSubtle}"/>
          <ellipse cx="${10 * scale}" cy="${15 * scale}" rx="${6 * scale}" ry="${3 * scale}" fill="${lightNeutralSubtle}"/>
          <ellipse cx="${3 * scale}" cy="${12 * scale}" rx="${3 * scale}" ry="${2 * scale}" fill="${darkNeutralSubtle}"/>
          <ellipse cx="${17 * scale}" cy="${3 * scale}" rx="${2 * scale}" ry="${2 * scale}" fill="${lightNeutralSubtle}"/>
        </pattern>
      `;
    
    case 'none':
    default:
      // 无纹理 - 返回空 pattern
      return `
        <pattern id="texturePattern" patternUnits="userSpaceOnUse" width="1" height="1">
          <rect width="1" height="1" fill="transparent"/>
        </pattern>
      `;
  }
}

/**
 * 渲染文字内容到文本框
 * 支持5个文本框（1标题 + 4内容）的新布局
 * 
 * @param baseBuffer - 基础图像 Buffer
 * @param textBoxes - 文本框配置数组
 * @param layout - 布局配置（可选，默认使用横版布局）
 * @returns 渲染后的图像 Buffer
 */
async function renderTextContent(
  baseBuffer: Buffer,
  textBoxes: TextBoxConfig[],
  layout?: LayoutConfig
): Promise<Buffer> {
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  
  // 使用传入的布局配置或默认横版布局
  const currentLayout = layout || LANDSCAPE_LAYOUT;
  const allTextBoxes = getAllTextBoxes(currentLayout);
  
  for (let i = 0; i < allTextBoxes.length; i++) {
    const layoutBox = allTextBoxes[i];
    const textConfig = textBoxes.find(tb => tb.id === layoutBox.id);
    const text = textConfig?.text || '';
    
    if (!text.trim()) continue;
    
    // 根据文本内容和文本框尺寸自动计算字体大小
    const fontSize = calculateFontSize(
      text,
      layoutBox.id,
      layoutBox.width,
      layoutBox.height
    );
    
    // 创建文字 SVG
    const textSvg = createTextSvg(
      text,
      layoutBox.width,
      layoutBox.height,
      fontSize
    );
    
    const textBuffer = await sharp(Buffer.from(textSvg))
      .png()
      .toBuffer();
    
    composites.push({
      input: textBuffer,
      left: layoutBox.x,
      top: layoutBox.y
    });
  }
  
  if (composites.length === 0) {
    return baseBuffer;
  }
  
  return sharp(baseBuffer)
    .composite(composites)
    .png()
    .toBuffer();
}

/**
 * 根据文本框类型获取合适的字体大小
 * 标题框使用 40px，内容框使用 30px
 * 
 * @param boxId - 文本框 ID
 * @returns 字体大小
 */
function getFontSizeForBox(boxId: string): number {
  if (boxId === 'title') {
    return CARD_FONT_STYLE.title.fontSize;  // 48px
  }
  return CARD_FONT_STYLE.content.fontSize;  // 36px
}

/**
 * 计算文本所需的行数
 * 
 * @param text - 文本内容
 * @param maxWidth - 最大宽度
 * @param fontSize - 字体大小
 * @returns 行数
 */
function calculateTextLines(text: string, maxWidth: number, fontSize: number): number {
  const avgCharWidth = fontSize * 0.8;
  const maxCharsPerLine = Math.floor((maxWidth - 40) / avgCharWidth);
  
  const paragraphs = text.split('\n');
  let totalLines = 0;
  
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      totalLines += 1;
    } else {
      totalLines += Math.ceil(paragraph.length / maxCharsPerLine);
    }
  }
  
  return totalLines;
}

/**
 * 根据文本内容和文本框尺寸自动计算合适的字体大小
 * 当文本溢出时自动缩小字体，但不低于最小字体大小
 * 
 * @param text - 文本内容
 * @param boxId - 文本框 ID
 * @param boxWidth - 文本框宽度
 * @param boxHeight - 文本框高度
 * @returns 计算后的字体大小
 */
function calculateFontSize(
  text: string,
  boxId: string,
  boxWidth: number,
  boxHeight: number
): number {
  const baseFontSize = getFontSizeForBox(boxId);
  const minFontSize = CARD_FONT_STYLE.minFontSize;  // 24px
  const lineHeight = boxId === 'title' 
    ? CARD_FONT_STYLE.title.lineHeight 
    : CARD_FONT_STYLE.content.lineHeight;
  
  let fontSize = baseFontSize;
  
  // 逐步缩小字体直到文本能够适应文本框
  while (fontSize > minFontSize) {
    const lines = calculateTextLines(text, boxWidth, fontSize);
    const totalTextHeight = lines * fontSize * lineHeight;
    const availableHeight = boxHeight - 20; // 留出上下边距
    
    if (totalTextHeight <= availableHeight) {
      break;
    }
    
    // 每次缩小 2px
    fontSize -= 2;
  }
  
  // 确保不低于最小字体大小
  return Math.max(fontSize, minFontSize);
}

/**
 * 转义 XML 特殊字符
 * 
 * @param text - 原始文本
 * @returns 转义后的文本
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 将文本按宽度自动换行
 * 
 * @param text - 原始文本
 * @param maxWidth - 最大宽度
 * @param fontSize - 字体大小
 * @returns 换行后的文本行数组
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  // 估算每个字符的宽度（中文字符约等于字体大小，英文约为字体大小的0.6倍）
  const avgCharWidth = fontSize * 0.8;
  const maxCharsPerLine = Math.floor((maxWidth - 40) / avgCharWidth); // 留出左右边距
  
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxCharsPerLine) {
      lines.push(paragraph);
    } else {
      // 需要换行
      let remaining = paragraph;
      while (remaining.length > 0) {
        if (remaining.length <= maxCharsPerLine) {
          lines.push(remaining);
          break;
        }
        lines.push(remaining.substring(0, maxCharsPerLine));
        remaining = remaining.substring(maxCharsPerLine);
      }
    }
  }
  
  return lines;
}

/**
 * 创建文字 SVG
 * 
 * @param text - 文本内容
 * @param width - 宽度
 * @param height - 高度
 * @param fontSize - 字体大小
 * @returns SVG 字符串
 */
function createTextSvg(
  text: string,
  width: number,
  height: number,
  fontSize: number
): string {
  const lines = wrapText(text, width, fontSize);
  const lineHeight = fontSize * 1.4;
  
  // 计算文本起始 Y 位置（垂直居中）
  const totalTextHeight = lines.length * lineHeight;
  const startY = (height - totalTextHeight) / 2 + fontSize * 0.8;
  
  // 生成文本行 SVG - 所有文本框内文字水平居中对齐
  const textElements = lines.map((line, index) => {
    const y = startY + index * lineHeight;
    const escapedLine = escapeXml(line);
    
    return `
      <text 
        x="${width / 2}" 
        y="${y}"
        font-family="serif, 'Times New Roman', SimSun"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        <tspan filter="url(#textShadow)">${escapedLine}</tspan>
      </text>
    `;
  }).join('');
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.8)"/>
        </filter>
      </defs>
      ${textElements}
    </svg>
  `;
}

/**
 * 合成卡牌并保存到文件
 * 
 * @param options - 合成选项
 * @returns 保存的文件 URL
 */
export async function composeCardAndSave(options: ComposeCardOptions): Promise<string> {
  const cardBuffer = await composeCard(options);
  
  const resultId = uuidv4();
  const resultFilename = `${resultId}.png`;
  const resultPath = path.join(__dirname, '..', '..', 'generated', resultFilename);
  
  await sharp(cardBuffer).png().toFile(resultPath);
  
  console.log(`卡牌保存到: ${resultPath}`);
  
  return `/generated/${resultFilename}`;
}
