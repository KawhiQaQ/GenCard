import sharp from 'sharp';
import { MaskConfig, FrameRect } from '../types/index.js';

/**
 * Mask 生成服务
 * 
 * 生成用于 Inpainting 的遮罩图像
 * 根据 wanx2.1-imageedit 的 description_edit_with_mask 功能：
 * - 白色区域 = 需要重绘的区域（背景）
 * - 黑色区域 = 保护区域（原画框 + 文本框）
 */

/**
 * 生成 Mask 图像
 * 
 * @param config - Mask 配置，包含画布尺寸和保护区域
 * @returns Mask 图像 Buffer（PNG 格式）
 */
export async function generateMask(config: MaskConfig): Promise<Buffer> {
  const { canvasWidth, canvasHeight, artworkFrame, textBoxes } = config;

  console.log('=== 开始生成 Mask ===');
  console.log('画布尺寸:', `${canvasWidth}x${canvasHeight}`);
  console.log('原画框:', JSON.stringify(artworkFrame));
  console.log('文本框数量:', textBoxes.length);

  // 验证配置
  validateMaskConfig(config);

  // 创建白色背景（重绘区域）
  const whiteBackground = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).png().toBuffer();

  // 收集所有保护区域（黑色矩形）
  const protectedAreas: { input: Buffer; left: number; top: number }[] = [];

  // 添加原画框保护区域（黑色 = 保护）
  const artworkRect = await createBlackRect(artworkFrame.width, artworkFrame.height);
  protectedAreas.push({
    input: artworkRect,
    left: Math.round(artworkFrame.x),
    top: Math.round(artworkFrame.y)
  });

  // 添加文本框保护区域（黑色 = 保护）
  for (const textBox of textBoxes) {
    const textBoxRect = await createBlackRect(textBox.width, textBox.height);
    protectedAreas.push({
      input: textBoxRect,
      left: Math.round(textBox.x),
      top: Math.round(textBox.y)
    });
  }

  // 合成 Mask 图像
  const maskBuffer = await sharp(whiteBackground)
    .composite(protectedAreas)
    .png()
    .toBuffer();

  console.log('=== Mask 生成完成 ===');
  console.log('保护区域数量:', protectedAreas.length);

  return maskBuffer;
}

/**
 * 创建黑色矩形图像（保护区域）
 * 
 * @param width - 矩形宽度
 * @param height - 矩形高度
 * @returns 黑色矩形图像 Buffer
 */
async function createBlackRect(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width: Math.round(width),
      height: Math.round(height),
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  }).png().toBuffer();
}

/**
 * 验证 Mask 配置
 * 
 * @param config - Mask 配置
 * @throws Error 如果配置无效
 */
function validateMaskConfig(config: MaskConfig): void {
  const { canvasWidth, canvasHeight, artworkFrame, textBoxes } = config;

  // 验证画布尺寸
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error(`无效的画布尺寸: ${canvasWidth}x${canvasHeight}`);
  }

  if (canvasWidth > 4096 || canvasHeight > 4096) {
    throw new Error(`画布尺寸超过限制: ${canvasWidth}x${canvasHeight}（最大 4096x4096）`);
  }

  // 验证原画框
  validateFrameRect(artworkFrame, canvasWidth, canvasHeight, '原画框');

  // 验证文本框
  for (let i = 0; i < textBoxes.length; i++) {
    validateFrameRect(textBoxes[i], canvasWidth, canvasHeight, `文本框 ${i + 1}`);
  }
}

/**
 * 验证矩形区域
 * 
 * @param rect - 矩形区域
 * @param canvasWidth - 画布宽度
 * @param canvasHeight - 画布高度
 * @param name - 区域名称（用于错误消息）
 */
function validateFrameRect(
  rect: FrameRect,
  canvasWidth: number,
  canvasHeight: number,
  name: string
): void {
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`${name}尺寸无效: ${rect.width}x${rect.height}`);
  }

  if (rect.x < 0 || rect.y < 0) {
    throw new Error(`${name}位置无效: (${rect.x}, ${rect.y})`);
  }

  if (rect.x + rect.width > canvasWidth || rect.y + rect.height > canvasHeight) {
    throw new Error(`${name}超出画布边界`);
  }
}

/**
 * 从布局配置生成 Mask 配置
 * 
 * 便捷函数，用于从前端传入的布局数据生成 Mask 配置
 * 
 * @param canvasWidth - 画布宽度
 * @param canvasHeight - 画布高度
 * @param artworkFrame - 原画框位置和尺寸
 * @param textBoxRects - 文本框位置和尺寸数组
 * @returns MaskConfig 对象
 */
export function createMaskConfig(
  canvasWidth: number,
  canvasHeight: number,
  artworkFrame: FrameRect,
  textBoxRects: FrameRect[]
): MaskConfig {
  return {
    canvasWidth,
    canvasHeight,
    artworkFrame,
    textBoxes: textBoxRects
  };
}
