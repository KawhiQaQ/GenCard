// 渐变光照配置模块 - 文本框渐变光照效果
// Requirements: 2.1, 2.2, 2.3, 2.4

/**
 * 渐变光照配置接口
 * 模拟顶部光源照射效果
 */
export interface GradientLightConfig {
  topBrightness: number;    // 顶部亮度增量 (0.08-0.12)
  bottomDarkness: number;   // 底部暗度增量 (0.05-0.08)
  colorStops: number;       // 渐变色阶数量 (至少3个)
}

/**
 * 默认渐变光照配置
 * 顶部亮度增加10%，底部暗度增加6%，使用3个色阶
 */
export const DEFAULT_GRADIENT_LIGHT: GradientLightConfig = {
  topBrightness: 0.10,
  bottomDarkness: 0.06,
  colorStops: 3
};

/**
 * 解析 RGBA 颜色字符串
 * 支持格式: rgba(r, g, b, a) 或 rgb(r, g, b)
 * 
 * @param color - RGBA 颜色字符串
 * @returns 解析后的颜色对象 { r, g, b, a }
 */
export function parseRgbaColor(color: string): { r: number; g: number; b: number; a: number } {
  // 匹配 rgba(r, g, b, a) 格式
  const rgbaMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
  
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    };
  }
  
  // 匹配 #RRGGBB 或 #RGB 格式
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1
      };
    } else if (hex.length === 8) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: parseInt(hex.substring(6, 8), 16) / 255
      };
    }
  }
  
  // 默认返回黑色
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * 将颜色对象转换为 RGBA 字符串
 * 
 * @param color - 颜色对象 { r, g, b, a }
 * @returns RGBA 颜色字符串
 */
export function toRgbaString(color: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a.toFixed(2)})`;
}

/**
 * 调整颜色亮度
 * 正值增加亮度，负值降低亮度
 * 
 * @param color - 颜色对象 { r, g, b, a }
 * @param factor - 亮度调整因子 (-1 到 1)
 * @returns 调整后的颜色对象
 */
export function adjustBrightness(
  color: { r: number; g: number; b: number; a: number },
  factor: number
): { r: number; g: number; b: number; a: number } {
  if (factor >= 0) {
    // 增加亮度：向白色靠近
    return {
      r: Math.min(255, color.r + (255 - color.r) * factor),
      g: Math.min(255, color.g + (255 - color.g) * factor),
      b: Math.min(255, color.b + (255 - color.b) * factor),
      a: color.a
    };
  } else {
    // 降低亮度：向黑色靠近
    const absFactor = Math.abs(factor);
    return {
      r: Math.max(0, color.r * (1 - absFactor)),
      g: Math.max(0, color.g * (1 - absFactor)),
      b: Math.max(0, color.b * (1 - absFactor)),
      a: color.a
    };
  }
}

/**
 * 根据基础色计算渐变色
 * 实现顶部光源照射效果：顶部亮、底部暗
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * @param baseColor - 基础颜色（RGBA 字符串）
 * @param config - 渐变光照配置（可选，默认使用 DEFAULT_GRADIENT_LIGHT）
 * @returns 渐变色数组 [顶部高光色, 中间基础色, 底部阴影色, ...]
 */
export function calculateGradientColors(
  baseColor: string,
  config: GradientLightConfig = DEFAULT_GRADIENT_LIGHT
): string[] {
  const parsedColor = parseRgbaColor(baseColor);
  const { topBrightness, bottomDarkness, colorStops } = config;
  
  // 确保至少有3个色阶
  const stops = Math.max(3, colorStops);
  const colors: string[] = [];
  
  if (stops === 3) {
    // 3个色阶：顶部高光、中间基础、底部阴影
    const topColor = adjustBrightness(parsedColor, topBrightness);
    const bottomColor = adjustBrightness(parsedColor, -bottomDarkness);
    
    colors.push(toRgbaString(topColor));
    colors.push(toRgbaString(parsedColor));
    colors.push(toRgbaString(bottomColor));
  } else {
    // 多个色阶：线性插值
    for (let i = 0; i < stops; i++) {
      const position = i / (stops - 1); // 0 到 1
      let factor: number;
      
      if (position <= 0.5) {
        // 上半部分：从高光到基础色
        factor = topBrightness * (1 - position * 2);
      } else {
        // 下半部分：从基础色到阴影
        factor = -bottomDarkness * ((position - 0.5) * 2);
      }
      
      const adjustedColor = adjustBrightness(parsedColor, factor);
      colors.push(toRgbaString(adjustedColor));
    }
  }
  
  return colors;
}

/**
 * 为现有渐变色数组应用光照效果
 * 用于增强已有的渐变配置
 * 
 * @param gradientColors - 现有渐变色数组
 * @param config - 渐变光照配置
 * @returns 应用光照效果后的渐变色数组
 */
export function applyGradientLight(
  gradientColors: readonly string[],
  config: GradientLightConfig = DEFAULT_GRADIENT_LIGHT
): string[] {
  if (gradientColors.length === 0) {
    return [];
  }
  
  // 使用中间颜色作为基础色重新计算
  const middleIndex = Math.floor(gradientColors.length / 2);
  const baseColor = gradientColors[middleIndex];
  
  return calculateGradientColors(baseColor, config);
}

/**
 * 生成 SVG 线性渐变定义
 * 用于在 SVG 中应用渐变光照效果
 * 
 * @param gradientId - 渐变 ID
 * @param colors - 渐变色数组
 * @param direction - 渐变方向 ('vertical' | 'horizontal')
 * @returns SVG linearGradient 定义字符串
 */
export function generateSvgGradientDef(
  gradientId: string,
  colors: string[],
  direction: 'vertical' | 'horizontal' = 'vertical'
): string {
  const x1 = direction === 'horizontal' ? '0%' : '0%';
  const y1 = direction === 'horizontal' ? '0%' : '0%';
  const x2 = direction === 'horizontal' ? '100%' : '0%';
  const y2 = direction === 'horizontal' ? '0%' : '100%';
  
  const stops = colors.map((color, index) => {
    const offset = (index / (colors.length - 1)) * 100;
    return `<stop offset="${offset}%" style="stop-color:${color}"/>`;
  }).join('\n          ');
  
  return `
        <linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
          ${stops}
        </linearGradient>`;
}
