import sharp from 'sharp';
import { LayoutDraft, TextBoxElement, ImageFrameElement } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * 草图渲染错误
 */
export class SketchRenderError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'SketchRenderError';
  }
}

/**
 * 渲染布局草图为图像
 * 用于 ControlNet 的输入
 * 
 * @param layout - 布局草图数据
 * @param uploadedImages - 上传图片的映射 (frameId -> 文件路径)
 * @returns PNG 格式的草图图像 Buffer
 */
export async function renderLayoutSketch(
  layout: LayoutDraft,
  uploadedImages: Map<string, string> = new Map()
): Promise<Buffer> {
  try {
    // 验证布局数据
    validateLayout(layout);

    // 创建基础画布
    const canvas = await createBaseCanvas(layout);

    // 准备合成层
    const compositeLayers: sharp.OverlayOptions[] = [];

    // 生成 SVG 元素层
    const svgLayer = await generateSVGLayer(layout);
    if (svgLayer) {
      compositeLayers.push({
        input: svgLayer,
        top: 0,
        left: 0
      });
    }

    // 处理上传的图片
    const imageLayers = await generateImageLayers(layout, uploadedImages);
    compositeLayers.push(...imageLayers);

    // 合成所有层
    const result = await canvas
      .composite(compositeLayers)
      .png()
      .toBuffer();

    return result;
  } catch (error) {
    if (error instanceof SketchRenderError) {
      throw error;
    }
    throw new SketchRenderError(
      '草图渲染失败: ' + (error instanceof Error ? error.message : String(error)),
      { originalError: error }
    );
  }
}

/**
 * 验证布局数据的有效性
 */
function validateLayout(layout: LayoutDraft): void {
  if (!layout || !layout.canvas) {
    throw new SketchRenderError('无效的布局数据：缺少画布配置');
  }

  const { width, height } = layout.canvas;
  if (width < 100 || width > 4096 || height < 100 || height > 4096) {
    throw new SketchRenderError(
      `画布尺寸超出允许范围: ${width}x${height}`,
      { width, height }
    );
  }

  if (!Array.isArray(layout.elements)) {
    throw new SketchRenderError('无效的布局数据：elements 必须是数组');
  }

  if (layout.elements.length > 50) {
    throw new SketchRenderError(
      `元素数量超过限制: ${layout.elements.length}`,
      { count: layout.elements.length }
    );
  }
}

/**
 * 创建基础画布
 * 支持圆角矩形和背景色
 */
async function createBaseCanvas(layout: LayoutDraft): Promise<sharp.Sharp> {
  const { canvas } = layout;
  const { width, height, cornerRadius = 0, backgroundColor = '#FFFFFF' } = canvas;

  // 解析背景色
  const bgColor = parseColor(backgroundColor);

  // 创建基础画布
  let baseCanvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bgColor
    }
  });

  // 如果有圆角，应用圆角遮罩
  if (cornerRadius > 0) {
    const roundedMask = generateRoundedRectangleSVG(width, height, cornerRadius);
    baseCanvas = baseCanvas.composite([{
      input: Buffer.from(roundedMask),
      blend: 'dest-in'
    }]);
  }

  return baseCanvas;
}

/**
 * 生成 SVG 图层（包含文字框和原画框边框）
 */
async function generateSVGLayer(layout: LayoutDraft): Promise<Buffer | null> {
  const { canvas, elements } = layout;
  const svgElements: string[] = [];

  for (const element of elements) {
    if (element.type === 'textbox') {
      svgElements.push(generateTextBoxSVG(element as TextBoxElement));
    } else if (element.type === 'imageframe') {
      svgElements.push(generateImageFrameSVG(element as ImageFrameElement));
    }
  }

  if (svgElements.length === 0) {
    return null;
  }

  // 构建完整的 SVG
  const svg = `
    <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements.join('\n')}
    </svg>
  `;

  return Buffer.from(svg);
}

/**
 * 生成文字框的 SVG 元素
 */
function generateTextBoxSVG(textBox: TextBoxElement): string {
  const { x, y, width, height, text, fontSize, hasBorder } = textBox;
  const elements: string[] = [];

  // 绘制边框
  if (hasBorder) {
    elements.push(`
      <rect 
        x="${x}" 
        y="${y}" 
        width="${width}" 
        height="${height}"
        fill="none" 
        stroke="black" 
        stroke-width="2"
      />
    `);
  }

  // 绘制文字内容
  // 计算文字位置（添加一些 padding）
  const textX = x + 5;
  const textY = y + fontSize + 5;

  elements.push(`
    <text 
      x="${textX}" 
      y="${textY}" 
      font-size="${fontSize}"
      font-family="Arial, sans-serif"
      fill="black"
    >${escapeXml(text)}</text>
  `);

  return elements.join('\n');
}

/**
 * 生成原画框的 SVG 边框
 */
function generateImageFrameSVG(imageFrame: ImageFrameElement): string {
  const { x, y, width, height } = imageFrame;

  // 如果有上传的图片，只绘制边框
  // 如果没有上传的图片，绘制边框和占位符
  const hasUploadedImage = imageFrame.uploadedImage?.id;

  const elements: string[] = [];

  // 绘制边框
  elements.push(`
    <rect 
      x="${x}" 
      y="${y}" 
      width="${width}" 
      height="${height}"
      fill="${hasUploadedImage ? 'none' : '#f0f0f0'}" 
      stroke="black" 
      stroke-width="2"
    />
  `);

  // 如果没有上传图片，添加占位符文本
  if (!hasUploadedImage) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    elements.push(`
      <text 
        x="${centerX}" 
        y="${centerY}" 
        font-size="14"
        font-family="Arial, sans-serif"
        fill="#666666"
        text-anchor="middle"
        dominant-baseline="middle"
      >Image Frame</text>
    `);
  }

  return elements.join('\n');
}

/**
 * 生成上传图片的合成层
 */
async function generateImageLayers(
  layout: LayoutDraft,
  uploadedImages: Map<string, string>
): Promise<sharp.OverlayOptions[]> {
  const layers: sharp.OverlayOptions[] = [];

  for (const element of layout.elements) {
    if (element.type === 'imageframe') {
      const imageFrame = element as ImageFrameElement;
      
      // 检查是否有上传的图片
      if (imageFrame.uploadedImage?.id && uploadedImages.has(imageFrame.id)) {
        try {
          const imagePath = uploadedImages.get(imageFrame.id)!;
          const imageLayer = await embedUploadedImage(imageFrame, imagePath);
          layers.push(imageLayer);
        } catch (error) {
          console.error(`Failed to embed image for frame ${imageFrame.id}:`, error);
          throw new SketchRenderError(
            `无法嵌入上传的图片: ${imageFrame.id}`,
            { frameId: imageFrame.id, error }
          );
        }
      }
    }
  }

  return layers;
}

/**
 * 嵌入上传的图片到原画框
 */
async function embedUploadedImage(
  imageFrame: ImageFrameElement,
  imagePath: string
): Promise<sharp.OverlayOptions> {
  // 检查文件是否存在
  try {
    await fs.access(imagePath);
  } catch {
    throw new SketchRenderError(
      `图片文件不存在: ${imagePath}`,
      { imagePath }
    );
  }

  // 调整图片尺寸以适应原画框
  const resizedImage = await sharp(imagePath)
    .resize(imageFrame.width, imageFrame.height, {
      fit: 'cover',
      position: 'center'
    })
    .toBuffer();

  return {
    input: resizedImage,
    top: imageFrame.y,
    left: imageFrame.x
  };
}

/**
 * 转义 XML 特殊字符
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
 * 解析颜色字符串为 sharp 颜色对象
 */
function parseColor(color: string): { r: number; g: number; b: number; alpha: number } {
  // 默认白色
  let r = 255, g = 255, b = 255, alpha = 1;

  // 处理十六进制颜色 (#RRGGBB 或 #RGB)
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  }
  // 处理 rgb/rgba 格式
  else if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
      alpha = match[4] ? parseFloat(match[4]) : 1;
    }
  }

  return { r, g, b, alpha };
}

/**
 * 生成圆角矩形 SVG 遮罩
 */
function generateRoundedRectangleSVG(width: number, height: number, radius: number): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect 
        x="0" 
        y="0" 
        width="${width}" 
        height="${height}"
        rx="${radius}"
        ry="${radius}"
        fill="white"
      />
    </svg>
  `;
}
