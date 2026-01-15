import sharp from 'sharp';
import { FrameRect } from '../types/index.js';

/**
 * 边框渲染服务
 * 
 * 为原画框和文本框渲染高级边框样式
 * 使用 Sharp 库合成边框到最终图像
 */

// 基础边框样式配置（保留向后兼容）
export interface BorderStyle {
  width: number;           // 边框粗度
  color: string;           // 边框颜色 (hex)
  innerColor?: string;     // 内边框颜色 (用于渐变效果)
  shadowBlur?: number;     // 阴影模糊度
  shadowColor?: string;    // 阴影颜色
}

// 增强的边框样式配置 - 支持多色渐变和金属效果
export interface EnhancedBorderStyle {
  width: number;                    // 边框粗度
  gradientColors: string[];         // 渐变色数组（至少3个）
  highlightColor: string;           // 高光颜色
  shadowBlur: number;               // 阴影模糊度
  shadowColor: string;              // 阴影颜色
  metallic: boolean;                // 是否启用金属效果
}

// 双线边框配置 - 支持外线、内线、间距和内描边
export interface DoubleLineBorderStyle {
  outerWidth: number;         // 外线粗度 (4-6px)
  innerWidth: number;         // 内线粗度 (1-2px)
  gap: number;                // 线间距 (1-2px)
  outerGradient: string[];    // 外线渐变色
  innerStrokeColor: string;   // 内描边颜色
  innerStrokeOpacity: number; // 内描边透明度 (0.3-0.5)
}

// 外发光配置接口 - Requirements: 5.1, 5.3
export interface OuterGlowConfig {
  blur: number;             // 模糊半径 (4-8px)
  color: string;            // 发光颜色 (#FFD700 暖金色)
  opacity: number;          // 透明度 (0.15-0.30)
  spread: number;           // 扩散距离 (2-4px)
}

// 外发光强度类型
export type GlowIntensity = 'subtle' | 'medium' | 'strong' | 'none';

// 外发光预设 - 淡、中、强 - Requirements: 5.1, 5.3
export const GLOW_PRESETS: Record<GlowIntensity, OuterGlowConfig> = {
  subtle: { blur: 4, opacity: 0.15, spread: 2, color: '#FFD700' },
  medium: { blur: 6, opacity: 0.22, spread: 3, color: '#FFD700' },
  strong: { blur: 8, opacity: 0.30, spread: 4, color: '#FFD700' },
  none: { blur: 0, opacity: 0, spread: 0, color: '#FFD700' }
} as const;

// 默认外发光配置
export const DEFAULT_GLOW_CONFIG: OuterGlowConfig = GLOW_PRESETS.medium;

// 增强的原画框双线边框样式
export const ENHANCED_ARTWORK_BORDER: DoubleLineBorderStyle = {
  outerWidth: 5,
  innerWidth: 1.5,
  gap: 1.5,
  outerGradient: ['#FFE4A0', '#D4AF37', '#B8860B', '#D4AF37', '#FFE4A0'],
  innerStrokeColor: '#000000',
  innerStrokeOpacity: 0.4
};

// 增强的文本框双线边框样式
export const ENHANCED_TEXTBOX_BORDER: DoubleLineBorderStyle = {
  outerWidth: 4,
  innerWidth: 1,
  gap: 1,
  outerGradient: ['#B8A080', '#8B7355', '#6B5335', '#8B7355', '#B8A080'],
  innerStrokeColor: '#000000',
  innerStrokeOpacity: 0.35
};

// 原画框边框样式 - 加粗金属渐变（7px，5色渐变）
export const ARTWORK_FRAME_BORDER: EnhancedBorderStyle = {
  width: 7,
  gradientColors: ['#E8D5A3', '#C9A962', '#8B7355', '#C9A962', '#E8D5A3'],
  highlightColor: 'rgba(255, 255, 255, 0.4)',
  shadowBlur: 3,
  shadowColor: 'rgba(0, 0, 0, 0.4)',
  metallic: true
};

// 文本框边框样式 - 加粗金属渐变（5px，5色渐变）
export const TEXT_BOX_BORDER: EnhancedBorderStyle = {
  width: 5,
  gradientColors: ['#B8A080', '#8B7355', '#6B5335', '#8B7355', '#B8A080'],
  highlightColor: 'rgba(255, 255, 255, 0.3)',
  shadowBlur: 2,
  shadowColor: 'rgba(0, 0, 0, 0.3)',
  metallic: true
};

// 边框预设 - 金/银/铜
export const BORDER_PRESETS = {
  gold: {
    gradientColors: ['#FFE4A0', '#D4AF37', '#B8860B', '#D4AF37', '#FFE4A0'],
    highlightColor: 'rgba(255, 255, 200, 0.5)'
  },
  silver: {
    gradientColors: ['#E8E8E8', '#C0C0C0', '#A0A0A0', '#C0C0C0', '#E8E8E8'],
    highlightColor: 'rgba(255, 255, 255, 0.6)'
  },
  bronze: {
    gradientColors: ['#E8C8A0', '#CD7F32', '#8B4513', '#CD7F32', '#E8C8A0'],
    highlightColor: 'rgba(255, 220, 180, 0.4)'
  }
} as const;

// 边框预设类型
export type BorderPreset = keyof typeof BORDER_PRESETS;

// 文本框圆角半径
export const TEXT_BOX_BORDER_RADIUS = 10;

// 最小边框间隙（Requirements: 2.1, 2.2, 2.3）
export const MIN_BORDER_GAP = 2;

/**
 * 边框尺寸计算接口
 * 用于计算双线边框的总占用空间
 * Requirements: 2.4, 2.6
 */
export interface BorderDimensions {
  outerWidth: number;      // 外线宽度
  gap: number;             // 线间距
  innerWidth: number;      // 内线宽度
  innerStroke: number;     // 内描边宽度
  glowPadding: number;     // 外发光空间 (blur + spread)
}

/**
 * 计算双线边框的总占用空间
 * 包括外线、间隙、内线、内描边和外发光
 * 
 * Requirements: 2.4, 2.6
 * 
 * @param border - 边框尺寸配置
 * @returns 边框总占用空间（单边）
 */
export function calculateTotalBorderSpace(border: BorderDimensions): number {
  return border.outerWidth + border.gap + border.innerWidth + border.innerStroke + border.glowPadding;
}

/**
 * 获取原画框边框尺寸配置
 * 
 * @param glowConfig - 可选的外发光配置
 * @returns 原画框边框尺寸
 */
export function getArtworkBorderDimensions(glowConfig?: OuterGlowConfig): BorderDimensions {
  const glow = glowConfig || DEFAULT_GLOW_CONFIG;
  return {
    outerWidth: ENHANCED_ARTWORK_BORDER.outerWidth,      // 5px
    gap: ENHANCED_ARTWORK_BORDER.gap,                    // 1.5px
    innerWidth: ENHANCED_ARTWORK_BORDER.innerWidth,      // 1.5px
    innerStroke: 2,                                       // 内描边 2px
    glowPadding: glow.opacity > 0 ? Math.ceil(glow.blur + glow.spread) : 0
  };
}

/**
 * 获取文本框边框尺寸配置
 * 
 * @param glowConfig - 可选的外发光配置
 * @returns 文本框边框尺寸
 */
export function getTextBoxBorderDimensions(glowConfig?: OuterGlowConfig): BorderDimensions {
  const glow = glowConfig || DEFAULT_GLOW_CONFIG;
  return {
    outerWidth: ENHANCED_TEXTBOX_BORDER.outerWidth,      // 4px
    gap: ENHANCED_TEXTBOX_BORDER.gap,                    // 1px
    innerWidth: ENHANCED_TEXTBOX_BORDER.innerWidth,      // 1px
    innerStroke: 2,                                       // 内描边 2px
    glowPadding: glow.opacity > 0 ? Math.ceil(glow.blur + glow.spread) : 0
  };
}

/**
 * 验证两个框体之间是否有足够的边框间隙
 * 
 * Requirements: 2.1, 2.2, 2.3
 * 
 * @param frame1 - 第一个框体（包含 x, y, width, height）
 * @param frame2 - 第二个框体
 * @param border1Dimensions - 第一个框体的边框尺寸
 * @param border2Dimensions - 第二个框体的边框尺寸
 * @param minGap - 最小间隙（默认 MIN_BORDER_GAP）
 * @returns 是否有足够间隙
 */
export function validateBorderGap(
  frame1: { x: number; y: number; width: number; height: number },
  frame2: { x: number; y: number; width: number; height: number },
  border1Dimensions: BorderDimensions,
  border2Dimensions: BorderDimensions,
  minGap: number = MIN_BORDER_GAP
): boolean {
  const border1Space = calculateTotalBorderSpace(border1Dimensions);
  const border2Space = calculateTotalBorderSpace(border2Dimensions);
  
  // 计算框体1的边界（包含边框）
  const frame1Left = frame1.x - border1Space;
  const frame1Right = frame1.x + frame1.width + border1Space;
  const frame1Top = frame1.y - border1Space;
  const frame1Bottom = frame1.y + frame1.height + border1Space;
  
  // 计算框体2的边界（包含边框）
  const frame2Left = frame2.x - border2Space;
  const frame2Right = frame2.x + frame2.width + border2Space;
  const frame2Top = frame2.y - border2Space;
  const frame2Bottom = frame2.y + frame2.height + border2Space;
  
  // 检查水平方向间隙
  const horizontalGap = Math.min(
    Math.abs(frame1Right - frame2Left),
    Math.abs(frame2Right - frame1Left)
  );
  
  // 检查垂直方向间隙
  const verticalGap = Math.min(
    Math.abs(frame1Bottom - frame2Top),
    Math.abs(frame2Bottom - frame1Top)
  );
  
  // 如果两个框体在水平或垂直方向上不重叠，则检查相应方向的间隙
  const horizontalOverlap = !(frame1Right < frame2Left || frame2Right < frame1Left);
  const verticalOverlap = !(frame1Bottom < frame2Top || frame2Bottom < frame1Top);
  
  if (!horizontalOverlap && !verticalOverlap) {
    // 对角线方向，两个方向都需要有间隙
    return true;
  }
  
  if (horizontalOverlap && !verticalOverlap) {
    // 垂直相邻
    return verticalGap >= minGap;
  }
  
  if (!horizontalOverlap && verticalOverlap) {
    // 水平相邻
    return horizontalGap >= minGap;
  }
  
  // 重叠情况
  return false;
}

/**
 * 验证框体边框是否在画布边界内
 * 
 * Requirements: 2.5
 * 
 * @param frame - 框体位置和尺寸
 * @param borderDimensions - 边框尺寸配置
 * @param canvasWidth - 画布宽度
 * @param canvasHeight - 画布高度
 * @returns 是否在边界内
 */
export function validateBorderWithinCanvas(
  frame: { x: number; y: number; width: number; height: number },
  borderDimensions: BorderDimensions,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  const borderSpace = calculateTotalBorderSpace(borderDimensions);
  
  const left = frame.x - borderSpace;
  const right = frame.x + frame.width + borderSpace;
  const top = frame.y - borderSpace;
  const bottom = frame.y + frame.height + borderSpace;
  
  return left >= 0 && right <= canvasWidth && top >= 0 && bottom <= canvasHeight;
}

/**
 * 解析十六进制颜色为 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 200, g: 169, b: 98 }; // 默认金色
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

/**
 * 创建单个边框矩形（空心）
 * 
 * @param outerWidth - 外部宽度
 * @param outerHeight - 外部高度
 * @param borderWidth - 边框粗度
 * @param color - 边框颜色
 * @returns 边框图像 Buffer
 */
async function createBorderRect(
  outerWidth: number,
  outerHeight: number,
  borderWidth: number,
  color: string
): Promise<Buffer> {
  const rgb = hexToRgb(color);
  
  // 创建外部矩形（实心）
  const outerRect = await sharp({
    create: {
      width: outerWidth,
      height: outerHeight,
      channels: 4,
      background: { r: rgb.r, g: rgb.g, b: rgb.b, alpha: 1 }
    }
  }).png().toBuffer();

  // 创建内部透明矩形（用于挖空）
  const innerWidth = outerWidth - borderWidth * 2;
  const innerHeight = outerHeight - borderWidth * 2;
  
  if (innerWidth <= 0 || innerHeight <= 0) {
    return outerRect;
  }

  const innerRect = await sharp({
    create: {
      width: innerWidth,
      height: innerHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  // 合成：在外部矩形上叠加透明内部
  return sharp(outerRect)
    .composite([{
      input: innerRect,
      left: borderWidth,
      top: borderWidth,
      blend: 'dest-out'
    }])
    .png()
    .toBuffer();
}


/**
 * 生成多色渐变的 SVG 停止点
 * 
 * @param colors - 渐变色数组
 * @returns SVG stop 元素字符串
 */
function generateGradientStops(colors: string[]): string {
  return colors.map((color, index) => {
    const offset = (index / (colors.length - 1)) * 100;
    return `<stop offset="${offset}%" style="stop-color:${color}"/>`;
  }).join('\n          ');
}

/**
 * 创建双线边框 SVG（原画框 - 无圆角）
 * 
 * 双线边框结构：
 * - 外发光（暖金色，模糊4-8px）
 * - 外线（粗，4-6px）：金色渐变
 * - 间隙（1-2px）
 * - 内线（细，1-2px）：金色
 * - 内描边（极细，1px）：黑色半透明
 * 
 * @param width - 总宽度
 * @param height - 总高度
 * @param style - 双线边框样式
 * @param uniqueId - 唯一ID
 * @param glowConfig - 外发光配置（可选）
 * @returns SVG 字符串
 */
function createDoubleLineBorderSvg(
  width: number,
  height: number,
  style: DoubleLineBorderStyle,
  uniqueId: string = 'artwork',
  glowConfig?: OuterGlowConfig
): string {
  const gradientStops = generateGradientStops(style.outerGradient);
  const glow = glowConfig || DEFAULT_GLOW_CONFIG;
  
  // 计算各层位置
  const outerHalf = style.outerWidth / 2;
  const innerLineOffset = style.outerWidth + style.gap;
  const innerHalf = style.innerWidth / 2;
  const innerStrokeOffset = innerLineOffset + style.innerWidth + 1;
  
  // 获取内线颜色（使用渐变中间色）
  const innerLineColor = style.outerGradient[Math.floor(style.outerGradient.length / 2)];
  
  // 外发光滤镜定义 - Requirements: 5.2, 5.4
  const glowFilterDef = glow.opacity > 0 ? `
        <!-- 外发光滤镜 - 暖金色 -->
        <filter id="${uniqueId}OuterGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="${glow.blur}" result="blur"/>
          <feFlood flood-color="${glow.color}" flood-opacity="${glow.opacity}"/>
          <feComposite in2="blur" operator="in" result="glowColor"/>
          <feMorphology in="glowColor" operator="dilate" radius="${glow.spread}" result="expandedGlow"/>
          <feMerge>
            <feMergeNode in="expandedGlow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>` : '';
  
  const glowFilterAttr = glow.opacity > 0 ? `filter="url(#${uniqueId}OuterGlow)"` : '';
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 外线渐变 -->
        <linearGradient id="${uniqueId}OuterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          ${gradientStops}
        </linearGradient>
        ${glowFilterDef}
      </defs>
      
      <!-- 外线 (粗) - 带外发光效果 -->
      <rect 
        x="${outerHalf}" 
        y="${outerHalf}" 
        width="${width - style.outerWidth}" 
        height="${height - style.outerWidth}" 
        fill="none" 
        stroke="url(#${uniqueId}OuterGradient)" 
        stroke-width="${style.outerWidth}"
        ${glowFilterAttr}
      />
      
      <!-- 内线 (细) -->
      <rect 
        x="${innerLineOffset + innerHalf}" 
        y="${innerLineOffset + innerHalf}" 
        width="${width - (innerLineOffset + innerHalf) * 2}" 
        height="${height - (innerLineOffset + innerHalf) * 2}" 
        fill="none" 
        stroke="${innerLineColor}" 
        stroke-width="${style.innerWidth}"
      />
      
      <!-- 内描边 (极细黑色) -->
      <rect 
        x="${innerStrokeOffset + 0.5}" 
        y="${innerStrokeOffset + 0.5}" 
        width="${width - (innerStrokeOffset + 0.5) * 2}" 
        height="${height - (innerStrokeOffset + 0.5) * 2}" 
        fill="none" 
        stroke="rgba(0,0,0,${style.innerStrokeOpacity})" 
        stroke-width="1"
      />
    </svg>
  `;
}

/**
 * 创建双线边框 SVG（文本框 - 带圆角）
 * 
 * @param width - 总宽度
 * @param height - 总高度
 * @param style - 双线边框样式
 * @param borderRadius - 圆角半径
 * @param uniqueId - 唯一ID
 * @param glowConfig - 外发光配置（可选）
 * @returns SVG 字符串
 */
function createDoubleLineRoundedBorderSvg(
  width: number,
  height: number,
  style: DoubleLineBorderStyle,
  borderRadius: number,
  uniqueId: string = 'textbox',
  glowConfig?: OuterGlowConfig
): string {
  const gradientStops = generateGradientStops(style.outerGradient);
  const glow = glowConfig || DEFAULT_GLOW_CONFIG;
  
  // 计算各层位置
  const outerHalf = style.outerWidth / 2;
  const innerLineOffset = style.outerWidth + style.gap;
  const innerHalf = style.innerWidth / 2;
  const innerStrokeOffset = innerLineOffset + style.innerWidth + 1;
  
  // 计算各层圆角（内层圆角需要减小）
  const outerRadius = borderRadius;
  const innerLineRadius = Math.max(0, borderRadius - style.outerWidth - style.gap);
  const innerStrokeRadius = Math.max(0, innerLineRadius - style.innerWidth - 1);
  
  // 获取内线颜色（使用渐变中间色）
  const innerLineColor = style.outerGradient[Math.floor(style.outerGradient.length / 2)];
  
  // 外发光滤镜定义 - Requirements: 5.2, 5.4
  const glowFilterDef = glow.opacity > 0 ? `
        <!-- 外发光滤镜 - 暖金色 -->
        <filter id="${uniqueId}OuterGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="${glow.blur}" result="blur"/>
          <feFlood flood-color="${glow.color}" flood-opacity="${glow.opacity}"/>
          <feComposite in2="blur" operator="in" result="glowColor"/>
          <feMorphology in="glowColor" operator="dilate" radius="${glow.spread}" result="expandedGlow"/>
          <feMerge>
            <feMergeNode in="expandedGlow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>` : '';
  
  const glowFilterAttr = glow.opacity > 0 ? `filter="url(#${uniqueId}OuterGlow)"` : '';
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 外线渐变 -->
        <linearGradient id="${uniqueId}OuterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          ${gradientStops}
        </linearGradient>
        ${glowFilterDef}
      </defs>
      
      <!-- 外线 (粗) - 带外发光效果 -->
      <rect 
        x="${outerHalf}" 
        y="${outerHalf}" 
        width="${width - style.outerWidth}" 
        height="${height - style.outerWidth}" 
        rx="${outerRadius}" 
        ry="${outerRadius}" 
        fill="none" 
        stroke="url(#${uniqueId}OuterGradient)" 
        stroke-width="${style.outerWidth}"
        ${glowFilterAttr}
      />
      
      <!-- 内线 (细) -->
      <rect 
        x="${innerLineOffset + innerHalf}" 
        y="${innerLineOffset + innerHalf}" 
        width="${width - (innerLineOffset + innerHalf) * 2}" 
        height="${height - (innerLineOffset + innerHalf) * 2}" 
        rx="${innerLineRadius}" 
        ry="${innerLineRadius}" 
        fill="none" 
        stroke="${innerLineColor}" 
        stroke-width="${style.innerWidth}"
      />
      
      <!-- 内描边 (极细黑色) -->
      <rect 
        x="${innerStrokeOffset + 0.5}" 
        y="${innerStrokeOffset + 0.5}" 
        width="${width - (innerStrokeOffset + 0.5) * 2}" 
        height="${height - (innerStrokeOffset + 0.5) * 2}" 
        rx="${innerStrokeRadius}" 
        ry="${innerStrokeRadius}" 
        fill="none" 
        stroke="rgba(0,0,0,${style.innerStrokeOpacity})" 
        stroke-width="1"
      />
    </svg>
  `;
}

/**
 * 渲染原画框双线边框
 * 
 * @param frame - 原画框位置和尺寸
 * @param customStyle - 可选的自定义双线边框样式
 * @param glowConfig - 可选的外发光配置
 * @returns 边框图像 Buffer 和位置信息
 */
export async function renderDoubleLineArtworkBorder(
  frame: FrameRect,
  customStyle?: Partial<DoubleLineBorderStyle>,
  glowConfig?: OuterGlowConfig
): Promise<{ buffer: Buffer; x: number; y: number }> {
  const style = { ...ENHANCED_ARTWORK_BORDER, ...customStyle };
  const glow = glowConfig || DEFAULT_GLOW_CONFIG;
  
  // 计算总边框宽度（外线 + 间隙 + 内线 + 内描边）
  const totalBorderWidth = style.outerWidth + style.gap + style.innerWidth + 2;
  
  // 外发光需要额外空间
  const glowPadding = glow.opacity > 0 ? Math.ceil(glow.blur + glow.spread) : 0;
  
  // 边框尺寸（包含边框本身和外发光空间）
  const totalWidth = frame.width + totalBorderWidth * 2 + glowPadding * 2;
  const totalHeight = frame.height + totalBorderWidth * 2 + glowPadding * 2;
  
  const borderSvg = createDoubleLineBorderSvg(
    totalWidth,
    totalHeight,
    style,
    'artwork',
    glow
  );
  
  const borderBuffer = await sharp(Buffer.from(borderSvg))
    .png()
    .toBuffer();
  
  return {
    buffer: borderBuffer,
    x: frame.x - totalBorderWidth - glowPadding,
    y: frame.y - totalBorderWidth - glowPadding
  };
}

/**
 * 渲染文本框双线边框（带圆角）
 * 
 * @param frame - 文本框位置和尺寸
 * @param customStyle - 可选的自定义双线边框样式
 * @param uniqueId - 唯一ID（用于多个边框时避免ID冲突）
 * @param glowConfig - 可选的外发光配置
 * @returns 边框图像 Buffer 和位置信息
 */
export async function renderDoubleLineTextBoxBorder(
  frame: FrameRect,
  customStyle?: Partial<DoubleLineBorderStyle>,
  uniqueId: string = 'textbox',
  glowConfig?: OuterGlowConfig
): Promise<{ buffer: Buffer; x: number; y: number }> {
  const style = { ...ENHANCED_TEXTBOX_BORDER, ...customStyle };
  const borderRadius = TEXT_BOX_BORDER_RADIUS;
  const glow = glowConfig || DEFAULT_GLOW_CONFIG;
  
  // 计算总边框宽度（外线 + 间隙 + 内线 + 内描边）
  const totalBorderWidth = style.outerWidth + style.gap + style.innerWidth + 2;
  
  // 外发光需要额外空间
  const glowPadding = glow.opacity > 0 ? Math.ceil(glow.blur + glow.spread) : 0;
  
  // 边框尺寸（包含边框本身和外发光空间）
  const totalWidth = frame.width + totalBorderWidth * 2 + glowPadding * 2;
  const totalHeight = frame.height + totalBorderWidth * 2 + glowPadding * 2;
  
  const borderSvg = createDoubleLineRoundedBorderSvg(
    totalWidth,
    totalHeight,
    style,
    borderRadius,
    uniqueId,
    glow
  );
  
  const borderBuffer = await sharp(Buffer.from(borderSvg))
    .png()
    .toBuffer();
  
  return {
    buffer: borderBuffer,
    x: frame.x - totalBorderWidth - glowPadding,
    y: frame.y - totalBorderWidth - glowPadding
  };
}

/**
 * 渲染所有双线边框并合成到图像
 * 
 * @param baseImage - 基础图像 Buffer
 * @param artworkFrame - 原画框位置和尺寸
 * @param textBoxes - 文本框位置和尺寸数组
 * @param artworkStyle - 可选的原画框边框样式
 * @param textBoxStyle - 可选的文本框边框样式
 * @param glowConfig - 可选的外发光配置
 * @returns 合成边框后的图像 Buffer
 */
export async function renderAllDoubleLineBorders(
  baseImage: Buffer,
  artworkFrame: FrameRect,
  textBoxes: FrameRect[],
  artworkStyle?: Partial<DoubleLineBorderStyle>,
  textBoxStyle?: Partial<DoubleLineBorderStyle>,
  glowConfig?: OuterGlowConfig
): Promise<Buffer> {
  console.log('=== 开始渲染双线边框 ===');
  console.log('原画框:', JSON.stringify(artworkFrame));
  console.log('文本框数量:', textBoxes.length);
  console.log('外发光配置:', glowConfig ? JSON.stringify(glowConfig) : '使用默认');

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  // 渲染原画框双线边框
  const artworkBorder = await renderDoubleLineArtworkBorder(artworkFrame, artworkStyle, glowConfig);
  composites.push({
    input: artworkBorder.buffer,
    left: Math.max(0, artworkBorder.x),
    top: Math.max(0, artworkBorder.y)
  });
  console.log('原画框双线边框渲染完成');

  // 渲染所有文本框双线边框（使用唯一ID避免SVG冲突）
  for (let i = 0; i < textBoxes.length; i++) {
    const textBoxBorder = await renderDoubleLineTextBoxBorder(
      textBoxes[i],
      textBoxStyle,
      `textbox${i}`,
      glowConfig
    );
    composites.push({
      input: textBoxBorder.buffer,
      left: Math.max(0, textBoxBorder.x),
      top: Math.max(0, textBoxBorder.y)
    });
    console.log(`文本框 ${i + 1} 双线边框渲染完成`);
  }

  // 合成所有边框到基础图像
  const result = await sharp(baseImage)
    .composite(composites)
    .png()
    .toBuffer();

  console.log('=== 双线边框渲染完成 ===');
  return result;
}

/**
 * 渲染原画框边框（增强版 - 多色渐变金属效果）
 * 
 * 使用 SVG 创建空心边框，支持5色渐变和金属高光效果
 * 
 * @param frame - 原画框位置和尺寸
 * @param customStyle - 可选的自定义边框样式
 * @returns 边框图像 Buffer 和位置信息
 */
export async function renderArtworkFrameBorder(
  frame: FrameRect,
  customStyle?: Partial<EnhancedBorderStyle>
): Promise<{ buffer: Buffer; x: number; y: number }> {
  const style = { ...ARTWORK_FRAME_BORDER, ...customStyle };
  const borderWidth = style.width;
  
  // 边框尺寸（包含边框本身）
  const totalWidth = frame.width + borderWidth * 2;
  const totalHeight = frame.height + borderWidth * 2;
  
  // 生成渐变停止点
  const gradientStops = generateGradientStops(style.gradientColors);
  
  // 使用 SVG 创建多色渐变边框（带金属高光和阴影效果）
  const borderSvg = `
    <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 主渐变 - 5色金属渐变 -->
        <linearGradient id="artworkBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          ${gradientStops}
        </linearGradient>
        
        <!-- 高光渐变 - 左上角金属高光 -->
        <linearGradient id="artworkHighlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${style.highlightColor}"/>
          <stop offset="30%" style="stop-color:rgba(255,255,255,0.1)"/>
          <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
        </linearGradient>
        
        <!-- 阴影滤镜 -->
        <filter id="artworkBorderShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="${style.shadowBlur}" flood-color="${style.shadowColor}"/>
        </filter>
      </defs>
      
      <!-- 主边框 - 多色渐变 -->
      <rect 
        x="${borderWidth / 2}" 
        y="${borderWidth / 2}" 
        width="${totalWidth - borderWidth}" 
        height="${totalHeight - borderWidth}" 
        fill="none" 
        stroke="url(#artworkBorderGradient)" 
        stroke-width="${borderWidth}"
        filter="url(#artworkBorderShadow)"
      />
      
      ${style.metallic ? `
      <!-- 金属高光层 - 左上角高光效果 -->
      <rect 
        x="${borderWidth / 2}" 
        y="${borderWidth / 2}" 
        width="${totalWidth - borderWidth}" 
        height="${totalHeight - borderWidth}" 
        fill="none" 
        stroke="url(#artworkHighlightGradient)" 
        stroke-width="${Math.max(1, borderWidth / 2)}"
      />
      ` : ''}
    </svg>
  `;
  
  const borderBuffer = await sharp(Buffer.from(borderSvg))
    .png()
    .toBuffer();
  
  return {
    buffer: borderBuffer,
    x: frame.x - borderWidth,
    y: frame.y - borderWidth
  };
}

/**
 * 创建带圆角的文本框边框 SVG（增强版 - 多色渐变金属效果）
 * 
 * @param width - 宽度
 * @param height - 高度
 * @param style - 增强边框样式
 * @param borderRadius - 圆角半径
 * @param uniqueId - 唯一ID（用于多个边框时避免ID冲突）
 * @returns SVG 字符串
 */
function createEnhancedRoundedBorderSvg(
  width: number,
  height: number,
  style: EnhancedBorderStyle,
  borderRadius: number,
  uniqueId: string = 'textbox'
): string {
  const halfBorder = style.width / 2;
  const gradientStops = generateGradientStops(style.gradientColors);
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 主渐变 - 5色金属渐变 -->
        <linearGradient id="${uniqueId}BorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          ${gradientStops}
        </linearGradient>
        
        <!-- 高光渐变 - 左上角金属高光 -->
        <linearGradient id="${uniqueId}HighlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${style.highlightColor}"/>
          <stop offset="30%" style="stop-color:rgba(255,255,255,0.1)"/>
          <stop offset="100%" style="stop-color:rgba(255,255,255,0)"/>
        </linearGradient>
        
        <!-- 阴影滤镜 -->
        <filter id="${uniqueId}BorderShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="${style.shadowBlur}" flood-color="${style.shadowColor}"/>
        </filter>
      </defs>
      
      <!-- 主边框 - 多色渐变 -->
      <rect 
        x="${halfBorder}" 
        y="${halfBorder}" 
        width="${width - style.width}" 
        height="${height - style.width}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="none" 
        stroke="url(#${uniqueId}BorderGradient)" 
        stroke-width="${style.width}"
        filter="url(#${uniqueId}BorderShadow)"
      />
      
      ${style.metallic ? `
      <!-- 金属高光层 - 左上角高光效果 -->
      <rect 
        x="${halfBorder}" 
        y="${halfBorder}" 
        width="${width - style.width}" 
        height="${height - style.width}" 
        rx="${borderRadius}" 
        ry="${borderRadius}" 
        fill="none" 
        stroke="url(#${uniqueId}HighlightGradient)" 
        stroke-width="${Math.max(1, style.width / 2)}"
      />
      ` : ''}
    </svg>
  `;
}

/**
 * 渲染文本框边框（增强版 - 带圆角和金属渐变效果）
 * 
 * @param frame - 文本框位置和尺寸
 * @param customStyle - 可选的自定义边框样式
 * @param uniqueId - 唯一ID（用于多个边框时避免ID冲突）
 * @returns 边框图像 Buffer 和位置信息
 */
export async function renderTextBoxBorder(
  frame: FrameRect,
  customStyle?: Partial<EnhancedBorderStyle>,
  uniqueId: string = 'textbox'
): Promise<{ buffer: Buffer; x: number; y: number }> {
  const style = { ...TEXT_BOX_BORDER, ...customStyle };
  const borderWidth = style.width;
  const borderRadius = TEXT_BOX_BORDER_RADIUS;
  
  // 边框尺寸（包含边框本身）
  const totalWidth = frame.width + borderWidth * 2;
  const totalHeight = frame.height + borderWidth * 2;
  
  // 使用增强版 SVG 创建圆角边框
  const borderSvg = createEnhancedRoundedBorderSvg(
    totalWidth,
    totalHeight,
    style,
    borderRadius,
    uniqueId
  );
  
  const borderBuffer = await sharp(Buffer.from(borderSvg))
    .png()
    .toBuffer();
  
  return {
    buffer: borderBuffer,
    x: frame.x - borderWidth,
    y: frame.y - borderWidth
  };
}

/**
 * 渲染所有边框并合成到图像
 * 
 * @param baseImage - 基础图像 Buffer
 * @param artworkFrame - 原画框位置和尺寸
 * @param textBoxes - 文本框位置和尺寸数组
 * @param borderPreset - 可选的边框预设（gold/silver/bronze）
 * @returns 合成边框后的图像 Buffer
 */
export async function renderAllBorders(
  baseImage: Buffer,
  artworkFrame: FrameRect,
  textBoxes: FrameRect[],
  borderPreset?: BorderPreset
): Promise<Buffer> {
  console.log('=== 开始渲染边框 ===');
  console.log('原画框:', JSON.stringify(artworkFrame));
  console.log('文本框数量:', textBoxes.length);
  console.log('边框预设:', borderPreset || '默认');

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  // 获取预设样式（如果指定）
  const presetStyle = borderPreset ? {
    gradientColors: BORDER_PRESETS[borderPreset].gradientColors as unknown as string[],
    highlightColor: BORDER_PRESETS[borderPreset].highlightColor
  } : undefined;

  // 渲染原画框边框
  const artworkBorder = await renderArtworkFrameBorder(artworkFrame, presetStyle);
  composites.push({
    input: artworkBorder.buffer,
    left: Math.max(0, artworkBorder.x),
    top: Math.max(0, artworkBorder.y)
  });
  console.log('原画框边框渲染完成');

  // 渲染所有文本框边框（使用唯一ID避免SVG冲突）
  for (let i = 0; i < textBoxes.length; i++) {
    const textBoxBorder = await renderTextBoxBorder(
      textBoxes[i],
      presetStyle,
      `textbox${i}`
    );
    composites.push({
      input: textBoxBorder.buffer,
      left: Math.max(0, textBoxBorder.x),
      top: Math.max(0, textBoxBorder.y)
    });
    console.log(`文本框 ${i + 1} 边框渲染完成`);
  }

  // 合成所有边框到基础图像
  const result = await sharp(baseImage)
    .composite(composites)
    .png()
    .toBuffer();

  console.log('=== 边框渲染完成 ===');
  return result;
}

/**
 * 根据外发光强度获取配置
 * 
 * @param intensity - 外发光强度 ('subtle' | 'medium' | 'strong' | 'none')
 * @returns 外发光配置
 */
export function getGlowConfig(intensity: GlowIntensity): OuterGlowConfig {
  return GLOW_PRESETS[intensity] || DEFAULT_GLOW_CONFIG;
}
