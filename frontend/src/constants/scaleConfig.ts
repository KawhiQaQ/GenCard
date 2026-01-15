/**
 * 整体比例缩放配置
 * 控制所有框体相对于画布的整体占比
 * Requirements: 7.5
 */

// 缩放预设类型
export type ScalePreset = 'standard' | 'moderate' | 'compact' | 'slim' | 'mini';

// 缩放配置接口
export interface ScaleConfig {
  factor: number;  // 缩放因子 (0.70-1.0)
  name: string;    // 显示名称
}

// 缩放预设配置
// Requirements: 7.1, 7.2, 7.3 - 提供五个预设级别：标准(100%)、适中(95%)、紧凑(90%)、精简(80%)、迷你(70%)
export const SCALE_PRESETS: Record<ScalePreset, ScaleConfig> = {
  standard: { factor: 1.0, name: '标准' },
  moderate: { factor: 0.95, name: '适中' },
  compact: { factor: 0.90, name: '紧凑' },
  slim: { factor: 0.80, name: '精简' },
  mini: { factor: 0.70, name: '迷你' }
} as const;

// 默认缩放预设
export const DEFAULT_SCALE_PRESET: ScalePreset = 'standard';

/**
 * 获取缩放配置
 * @param preset - 缩放预设
 * @returns 缩放配置
 */
export function getScaleConfig(preset: ScalePreset): ScaleConfig {
  return SCALE_PRESETS[preset];
}

/**
 * 验证缩放预设是否有效
 * @param preset - 缩放预设字符串
 * @returns 是否有效
 */
export function isValidScalePreset(preset: string): preset is ScalePreset {
  return preset in SCALE_PRESETS;
}

/**
 * 获取所有缩放预设选项（用于UI选择器）
 * @returns 缩放预设选项数组
 */
export function getScalePresetOptions(): Array<{ id: ScalePreset; name: string; factor: number }> {
  return Object.entries(SCALE_PRESETS).map(([id, config]) => ({
    id: id as ScalePreset,
    name: config.name,
    factor: config.factor
  }));
}

// 矩形接口（用于缩放计算）
export interface ScalableRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 带ID的矩形接口
export interface ScalableRectWithId extends ScalableRect {
  id: string;
}

// 布局配置接口（用于缩放）
export interface ScalableLayoutConfig {
  canvas: { width: number; height: number };
  artworkFrame: ScalableRect;
  titleBox: ScalableRectWithId;
  contentBoxes: ScalableRectWithId[];
}

/**
 * 缩放单个矩形，保持相对于画布中心的位置
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * 
 * @param rect - 原始矩形
 * @param scaleFactor - 缩放因子
 * @param centerX - 画布中心X坐标
 * @param centerY - 画布中心Y坐标
 * @returns 缩放后的矩形
 */
export function scaleRect<T extends ScalableRect>(
  rect: T,
  scaleFactor: number,
  centerX: number,
  centerY: number
): T {
  // 计算矩形中心点
  const rectCenterX = rect.x + rect.width / 2;
  const rectCenterY = rect.y + rect.height / 2;
  
  // 计算矩形中心相对于画布中心的偏移
  const offsetX = rectCenterX - centerX;
  const offsetY = rectCenterY - centerY;
  
  // 缩放偏移量和尺寸
  const scaledOffsetX = offsetX * scaleFactor;
  const scaledOffsetY = offsetY * scaleFactor;
  const scaledWidth = rect.width * scaleFactor;
  const scaledHeight = rect.height * scaleFactor;
  
  // 计算新的左上角位置
  const newCenterX = centerX + scaledOffsetX;
  const newCenterY = centerY + scaledOffsetY;
  const newX = newCenterX - scaledWidth / 2;
  const newY = newCenterY - scaledHeight / 2;
  
  return {
    ...rect,
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight)
  };
}

/**
 * 应用缩放因子到整个布局配置
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * - 7.1: 应用 0.90-0.95 的缩放因子到所有框体元素
 * - 7.2: 保持比例间距
 * - 7.3: 居中缩放后的布局
 * - 7.4: 保持原画框和文本框之间的对齐关系
 * 
 * @param layout - 原始布局配置
 * @param scaleFactor - 缩放因子 (0.90-1.0)
 * @returns 缩放后的布局配置
 */
export function applyScaleFactor<T extends ScalableLayoutConfig>(
  layout: T,
  scaleFactor: number
): T {
  // 限制缩放因子在有效范围内 (0.70-1.0)
  const clampedFactor = Math.max(0.70, Math.min(1.0, scaleFactor));
  
  // 如果缩放因子为1.0，直接返回原布局
  if (clampedFactor === 1.0) {
    return layout;
  }
  
  // 计算画布中心
  const centerX = layout.canvas.width / 2;
  const centerY = layout.canvas.height / 2;
  
  // 缩放原画框
  const scaledArtworkFrame = scaleRect(layout.artworkFrame, clampedFactor, centerX, centerY);
  
  // 缩放标题框
  const scaledTitleBox = scaleRect(layout.titleBox, clampedFactor, centerX, centerY);
  
  // 缩放所有内容框
  const scaledContentBoxes = layout.contentBoxes.map(box => 
    scaleRect(box, clampedFactor, centerX, centerY)
  );
  
  return {
    ...layout,
    canvas: layout.canvas, // 画布尺寸保持不变
    artworkFrame: scaledArtworkFrame,
    titleBox: scaledTitleBox,
    contentBoxes: scaledContentBoxes
  };
}

/**
 * 根据缩放预设应用缩放
 * @param layout - 原始布局配置
 * @param preset - 缩放预设
 * @returns 缩放后的布局配置
 */
export function applyScalePreset<T extends ScalableLayoutConfig>(
  layout: T,
  preset: ScalePreset
): T {
  const config = getScaleConfig(preset);
  return applyScaleFactor(layout, config.factor);
}
