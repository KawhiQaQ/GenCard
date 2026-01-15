// 卡牌布局常量 - 支持横版/竖版布局模式（4选1布局变体）

// 布局模式类型（保留向后兼容）
export type LayoutMode = 'landscape' | 'portrait';

// 布局变体类型（4选1）
export type LayoutVariant = 
  | 'landscape-square'   // 横版方形
  | 'landscape-flat'     // 横版扁平
  | 'portrait-square'    // 竖版方形
  | 'portrait-flat';     // 竖版扁平

// 内容框形状
export type ContentBoxShape = 'square' | 'flat';

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

// 根据布局模式获取配置（向后兼容）
export function getLayoutConfig(mode: LayoutMode): LayoutConfig {
  return mode === 'landscape' ? LANDSCAPE_LAYOUT : PORTRAIT_LAYOUT;
}

// 根据布局变体获取配置（新API，支持4选1）
export function getLayoutConfigByVariant(variant: LayoutVariant): LayoutConfig {
  return LAYOUT_VARIANTS[variant];
}

// 从布局变体获取布局模式（用于向后兼容）
export function getLayoutModeFromVariant(variant: LayoutVariant): LayoutMode {
  return variant.startsWith('landscape') ? 'landscape' : 'portrait';
}

// 从布局变体获取内容框形状
export function getContentBoxShapeFromVariant(variant: LayoutVariant): ContentBoxShape {
  return variant.endsWith('flat') ? 'flat' : 'square';
}

// 获取所有文本框（标题框 + 内容框）
export function getAllTextBoxes(layout: LayoutConfig): TextBoxRect[] {
  return [layout.titleBox, ...layout.contentBoxes];
}

// Premium 底色选项（带渐变纹理）
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

// 字体配置
export const FONT_CONFIG = {
  title: {
    fontSize: 40,           // 标题字体大小
    fontWeight: 'bold' as const,
    lineHeight: 1.3
  },
  content: {
    fontSize: 30,           // 内容字体大小（标题的75%）
    fontWeight: 'bold' as const,
    lineHeight: 1.4
  },
  minFontSize: 20,          // 最小字体大小
  fontFamily: 'serif, "Times New Roman", SimSun'
};

// 文本框样式配置
export const TEXT_BOX_STYLE = {
  borderWidth: 3,
  borderColor: '#8B7355',  // 深棕色边框
  borderRadius: 10         // 圆角半径
} as const;

// 原画框样式配置
export const ARTWORK_FRAME_STYLE = {
  borderWidth: 4,
  borderColor: '#C9A962'  // 金色高级边框
} as const;

// 原画生成尺寸（横版，与原画框宽高比匹配）
export const ARTWORK_SIZE_LANDSCAPE = {
  width: 720,   // 略大于原画框 400px
  height: 1280  // 保持 400:688 ≈ 9:16 的宽高比
} as const;

// 原画生成尺寸（竖版，正方形）
export const ARTWORK_SIZE_PORTRAIT = {
  width: 1024,  // 正方形尺寸
  height: 1024  // 正方形尺寸，更好适配竖版布局的原画框
} as const;

// 根据布局模式获取原画尺寸的映射表
export const ARTWORK_SIZE_BY_MODE = {
  landscape: { width: 720, height: 1280 },   // 横版：现有尺寸
  portrait: { width: 1024, height: 1024 }    // 竖版：正方形
} as const;

// 组合 layoutMode 和 contentBoxShape 为 layoutVariant
export function combineLayoutVariant(
  mode: LayoutMode,
  shape: ContentBoxShape
): LayoutVariant {
  return `${mode}-${shape}` as LayoutVariant;
}

// 根据布局模式获取原画尺寸
export function getArtworkSize(mode: LayoutMode) {
  return ARTWORK_SIZE_BY_MODE[mode];
}

// 类型导出
export type PremiumColorId = typeof PREMIUM_TEXTBOX_COLORS[number]['id'];
export type TextBoxId = 'title' | 'content1' | 'content2' | 'content3' | 'content4';

// 兼容旧版 CARD_LAYOUT（使用横版布局）
export const CARD_LAYOUT = {
  canvas: LANDSCAPE_LAYOUT.canvas,
  artworkFrame: {
    ...LANDSCAPE_LAYOUT.artworkFrame,
    borderWidth: ARTWORK_FRAME_STYLE.borderWidth,
    borderColor: ARTWORK_FRAME_STYLE.borderColor
  },
  textBoxes: getAllTextBoxes(LANDSCAPE_LAYOUT),
  textBoxStyle: TEXT_BOX_STYLE
} as const;

// 兼容旧版 PREMIUM_COLORS
export const PREMIUM_COLORS = PREMIUM_TEXTBOX_COLORS.map(color => ({
  id: color.id,
  name: color.name,
  value: color.gradient[0]  // 使用渐变的第一个颜色作为单色值
}));

// 兼容旧版 ARTWORK_SIZE
export const ARTWORK_SIZE = ARTWORK_SIZE_LANDSCAPE;
