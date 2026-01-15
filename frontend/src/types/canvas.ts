// 画布配置
export interface CanvasConfig {
  width: number;
  height: number;
  cornerRadius: number;  // 0表示矩形，>0表示圆角矩形
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
    file?: File;  // 用于预览
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

// 生成响应
export interface GenerationResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationTime?: number;
}

// 上传响应
export interface UploadResponse {
  success: boolean;
  imageId?: string;
  url?: string;
  error?: string;
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

// 内容框形状类型
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

// 原画数据（第一阶段输出）
export interface ArtworkData {
  imageUrl: string;
  isUploaded: boolean;  // 区分是生成的还是上传的
  layoutMode: LayoutMode;  // 布局模式（横版/竖版）
}

// 文本框配置（用于卡牌布局阶段）
export interface TextBoxConfig {
  id: string;
  text: string;
  // backgroundColor 已移除，改用全局 textBoxColorId
}

// 卡牌生成请求（第二阶段）- 增强版
export interface CardGenerationRequest {
  artworkUrl: string;
  layoutMode: LayoutMode;           // 布局模式（横版/竖版）- 向后兼容
  layoutVariant: LayoutVariant;     // 4选1布局变体
  textBoxes: TextBoxConfig[];
  textBoxColorId: string;           // 文本框底色ID
  borderPreset?: 'gold' | 'silver' | 'bronze';  // 边框预设（可选）
  backgroundPrompt: string;
  
  // 视觉增强选项
  textureType: TextureType;         // 纹理类型
  blurIntensity: BlurIntensity;     // 模糊强度
  glowIntensity: GlowIntensity;     // 外发光强度
  scalePreset: ScalePreset;         // 缩放预设
}
