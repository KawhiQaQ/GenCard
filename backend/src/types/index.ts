// 画布配置
export interface CanvasConfig {
  width: number;
  height: number;
  cornerRadius: number;
  backgroundColor: string;
}

// 文本框元素
export interface TextBoxElement {
  id: string;
  type: 'textbox';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  hasBorder: boolean;
}

// 原画框元素
export interface ImageFrameElement {
  id: string;
  type: 'imageframe';
  x: number;
  y: number;
  width: number;
  height: number;
  uploadedImage?: {
    id: string;
    url: string;
    file?: File;
  };
}

// 提示词输入
export interface PromptInput {
  contentPrompt: string | null;  // 原画框内容描述，如果有上传图片则为 null
  stylePrompt: string;            // 卡牌风格描述
}

// 布局草图
export interface LayoutDraft {
  canvas: CanvasConfig;
  elements: (TextBoxElement | ImageFrameElement)[];
  layoutImage?: string; // base64 编码的画布图像
}

// 生成请求
export interface GenerationRequest {
  layout: LayoutDraft;
  promptInput: PromptInput;
}

// ControlNet 配置
export interface ControlNetConfig {
  preprocessor: 'canny' | 'depth' | 'pose';
  scale: number;  // ControlNet 控制强度，0-2，默认 1.0
  // 对于有上传图片的原画框区域，使用更高的控制强度
  regionScales?: {
    [frameId: string]: number;  // 特定区域的控制强度
  };
}

// 生成配置
export interface GenerationConfig {
  width: number;
  height: number;
  steps: number;              // 扩散步数，默认 30
  guidanceScale: number;      // 文本引导强度，默认 7.5
  controlnetScale: number;    // ControlNet 强度，默认 1.0
  seed?: number;              // 随机种子，用于可重复生成
  negativePrompt?: string;    // 负面提示词
}

// 生成响应
export interface GenerationResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationTime?: number;
}

// ============ 新流程类型定义 ============

// 布局模式类型
export type LayoutMode = 'landscape' | 'portrait';

// 布局变体类型（4选1）
export type LayoutVariant = 
  | 'landscape-square'   // 横版方形
  | 'landscape-flat'     // 横版扁平
  | 'portrait-square'    // 竖版方形
  | 'portrait-flat';     // 竖版扁平

// 内容框形状
export type ContentBoxShape = 'square' | 'flat';

// 纹理类型
export type TextureType = 'matte-paper' | 'silk' | 'ink-wash' | 'none';

// 模糊强度类型
export type BlurIntensity = 'light' | 'medium' | 'strong';

// 外发光强度类型
export type GlowIntensity = 'subtle' | 'medium' | 'strong' | 'none';

// 缩放预设类型
// Requirements: 7.1, 7.2, 7.3 - 提供五个预设级别：标准(100%)、适中(95%)、紧凑(90%)、精简(80%)、迷你(70%)
export type ScalePreset = 'standard' | 'moderate' | 'compact' | 'slim' | 'mini';

// 原画生成请求
export interface ArtworkGenerateRequest {
  prompt: string;           // 人物描述提示词
  width?: number;           // 可选，默认使用原画框匹配尺寸
  height?: number;
}

// 原画生成响应
export interface ArtworkGenerateResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationTime?: number;
}

// 文本框配置
export interface TextBoxConfig {
  id: string;
  text: string;
  // backgroundColor 已移除，改用全局 textBoxColorId
}

// 卡牌背景生成请求
export interface CardBackgroundRequest {
  artworkUrl: string;       // 原画图片 URL
  layoutMode: LayoutMode;   // 布局模式（横版/竖版）- 向后兼容
  layoutVariant?: LayoutVariant;  // 4选1布局变体（可选，优先于 layoutMode）
  textBoxes: TextBoxConfig[];
  textBoxColorId: string;   // 文本框底色ID
  borderPreset?: 'gold' | 'silver' | 'bronze';  // 边框预设（可选）
  backgroundPrompt: string;
  canvasWidth: number;
  canvasHeight: number;
  
  // 视觉增强选项 - Requirements: 1.1, 3.2, 5.3, 7.5
  textureType?: TextureType;       // 纹理类型（可选，默认 matte-paper）
  blurIntensity?: BlurIntensity;   // 模糊强度（可选，默认 medium）
  glowIntensity?: GlowIntensity;   // 外发光强度（可选，默认 medium）
  scalePreset?: ScalePreset;       // 缩放预设（可选，默认 standard）
}

// 卡牌背景生成响应
export interface CardBackgroundResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationTime?: number;
}

// Mask 配置
export interface MaskConfig {
  canvasWidth: number;
  canvasHeight: number;
  artworkFrame: FrameRect;
  textBoxes: FrameRect[];
}

// 矩形区域
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 文生图配置
export interface TextToImageConfig {
  width: number;
  height: number;
  seed?: number;
  negativePrompt?: string;
  skipPromptEnhancement?: boolean;  // 跳过提示词增强（用于背景生成）
}

// 局部重绘配置
export interface InpaintConfig {
  strength?: number;      // 重绘强度，0-1，默认 0.8
  seed?: number;
  negativePrompt?: string;
}

// ============ 裁剪配置类型定义 (Requirements: 3.3) ============

/**
 * 裁剪锚点类型
 * 
 * 定义原画裁剪时的对齐位置：
 * - 'top': 顶部对齐，优先保留原画上部区域（适合竖版布局，保留人物头部）
 * - 'center': 居中对齐，保留原画中间区域（默认行为，适合横版布局）
 * - 'bottom': 底部对齐，优先保留原画下部区域
 * 
 * Requirements: 3.3
 */
export type CropAnchor = 'top' | 'center' | 'bottom';

/**
 * 裁剪配置接口
 * 
 * 定义原画裁剪的完整配置参数
 * 
 * Requirements: 3.3
 */
export interface CropConfig {
  /** 裁剪锚点位置 */
  anchor: CropAnchor;
  /** 目标宽度 */
  targetWidth: number;
  /** 目标高度 */
  targetHeight: number;
}
