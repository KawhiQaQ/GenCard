/**
 * 外发光配置模块
 * 
 * 定义边框外发光效果的配置和预设
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

// 外发光配置接口
export interface OuterGlowConfig {
  blur: number;             // 模糊半径 (4-8px)
  color: string;            // 发光颜色 (#FFD700 暖金色)
  opacity: number;          // 透明度 (0.15-0.30)
  spread: number;           // 扩散距离 (2-4px)
}

// 外发光强度类型
export type GlowIntensity = 'subtle' | 'medium' | 'strong' | 'none';

// 外发光预设 - 淡、中、强
export const GLOW_PRESETS: Record<GlowIntensity, OuterGlowConfig & { name: string }> = {
  subtle: { blur: 4, opacity: 0.15, spread: 2, color: '#FFD700', name: '淡' },
  medium: { blur: 6, opacity: 0.22, spread: 3, color: '#FFD700', name: '中' },
  strong: { blur: 8, opacity: 0.30, spread: 4, color: '#FFD700', name: '强' },
  none: { blur: 0, opacity: 0, spread: 0, color: '#FFD700', name: '无' }
} as const;

// 默认外发光配置
export const DEFAULT_GLOW_CONFIG: OuterGlowConfig = GLOW_PRESETS.medium;

// 外发光强度选项（用于UI选择器）
export const GLOW_INTENSITY_OPTIONS: Array<{ value: GlowIntensity; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'subtle', label: '淡' },
  { value: 'medium', label: '中' },
  { value: 'strong', label: '强' }
];

/**
 * 根据外发光强度获取配置
 * 
 * @param intensity - 外发光强度
 * @returns 外发光配置
 */
export function getGlowConfig(intensity: GlowIntensity): OuterGlowConfig {
  return GLOW_PRESETS[intensity] || DEFAULT_GLOW_CONFIG;
}

/**
 * 生成外发光CSS样式（用于前端预览）
 * 
 * @param config - 外发光配置
 * @returns CSS box-shadow 字符串
 */
export function generateGlowCss(config: OuterGlowConfig): string {
  if (config.opacity <= 0) {
    return 'none';
  }
  
  // 将十六进制颜色转换为带透明度的rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(255, 215, 0, ${alpha})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const color = hexToRgba(config.color, config.opacity);
  return `0 0 ${config.blur}px ${config.spread}px ${color}`;
}
