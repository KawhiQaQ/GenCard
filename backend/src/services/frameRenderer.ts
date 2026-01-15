/**
 * Frame Renderer Service - 边框渲染服务
 * 
 * 本文件实现了卡牌装饰边框的渲染功能，包括：
 * - 角饰渲染（含镜像变换）
 * - 边框条渲染
 * - 完整边框合成
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.4, 3.5
 */

import sharp from 'sharp';
import {
  FramePresetConfig,
  FrameRenderOptions,
  CornerPosition,
  BorderPosition,
  Position,
  BorderDimensions,
  CORNER_TRANSFORMS,
} from '../types/frame';
import { FRAME_PRESETS, isDecorativePreset, FRAME_ERROR_MESSAGES } from './framePresets';
import { loadAsset, validateAssetExists } from './assetLoader';
import { LayoutVariant } from '../types/index';

/**
 * 所有角落位置
 */
const ALL_CORNERS: CornerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * 所有边框位置
 */
const ALL_BORDERS: BorderPosition[] = ['top', 'right', 'bottom', 'left'];

/**
 * 获取布局的缩放因子
 * 
 * 根据布局变体返回适当的缩放因子：
 * - 横版布局 (1024x768): 100%
 * - 竖版布局 (768x1024): 95%
 * 
 * @param layoutVariant - 布局变体
 * @returns 缩放因子 (0-1)
 * 
 * Requirements: 4.1, 4.2
 */
export function getScaleFactorForLayout(layoutVariant?: LayoutVariant): number {
  if (!layoutVariant) return 1.0;
  
  // 竖版布局使用 95% 缩放
  if (layoutVariant.startsWith('portrait')) {
    return 0.95;
  }
  
  // 横版布局使用 100% 缩放
  return 1.0;
}

/**
 * 计算角饰位置
 * 
 * 根据角落位置、卡牌尺寸和内嵌偏移量计算角饰的放置坐标。
 * 
 * @param position - 角落位置
 * @param cardWidth - 卡牌宽度
 * @param cardHeight - 卡牌高度
 * @param cornerSize - 角饰尺寸
 * @param insetOffset - 内嵌偏移量
 * @returns 角饰位置坐标
 * 
 * Requirements: 2.1, 2.2
 */
export function calculateCornerPosition(
  position: CornerPosition,
  cardWidth: number,
  cardHeight: number,
  cornerSize: number,
  insetOffset: number
): Position {
  switch (position) {
    case 'top-left':
      return {
        x: insetOffset,
        y: insetOffset,
      };
    case 'top-right':
      return {
        x: cardWidth - cornerSize - insetOffset,
        y: insetOffset,
      };
    case 'bottom-left':
      return {
        x: insetOffset,
        y: cardHeight - cornerSize - insetOffset,
      };
    case 'bottom-right':
      return {
        x: cardWidth - cornerSize - insetOffset,
        y: cardHeight - cornerSize - insetOffset,
      };
  }
}

/**
 * 计算边框条位置和尺寸
 * 
 * 根据边框位置、卡牌尺寸、角饰尺寸和内嵌偏移量计算边框条的放置坐标和尺寸。
 * 边框条连接相邻的角饰，不与角饰重叠。
 * 
 * @param position - 边框位置
 * @param cardWidth - 卡牌宽度
 * @param cardHeight - 卡牌高度
 * @param cornerSize - 角饰尺寸
 * @param borderThickness - 边框厚度
 * @param insetOffset - 内嵌偏移量
 * @returns 边框条位置和尺寸
 * 
 * Requirements: 3.1, 3.4, 3.5
 */
export function calculateBorderPosition(
  position: BorderPosition,
  cardWidth: number,
  cardHeight: number,
  cornerSize: number,
  borderThickness: number,
  insetOffset: number
): BorderDimensions {
  // 边框条起始位置需要避开角饰区域
  const borderStart = cornerSize + insetOffset;
  
  switch (position) {
    case 'top':
      return {
        x: borderStart,
        y: insetOffset,
        width: cardWidth - 2 * borderStart,
        height: borderThickness,
      };
    case 'bottom':
      return {
        x: borderStart,
        y: cardHeight - borderThickness - insetOffset,
        width: cardWidth - 2 * borderStart,
        height: borderThickness,
      };
    case 'left':
      return {
        x: insetOffset,
        y: borderStart,
        width: borderThickness,
        height: cardHeight - 2 * borderStart,
      };
    case 'right':
      return {
        x: cardWidth - borderThickness - insetOffset,
        y: borderStart,
        width: borderThickness,
        height: cardHeight - 2 * borderStart,
      };
  }
}


/**
 * 渲染单个角饰
 * 
 * 加载角饰资源并应用适当的镜像变换。
 * 
 * @param preset - 边框预设配置
 * @param position - 角落位置
 * @param scaleFactor - 缩放因子
 * @returns 渲染后的角饰 Buffer
 * 
 * Requirements: 2.3, 2.4, 2.5, 2.6, 2.7
 */
export async function renderCornerOrnament(
  preset: FramePresetConfig,
  position: CornerPosition,
  scaleFactor: number = 1.0
): Promise<Buffer> {
  // 加载角饰资源
  const cornerBuffer = await loadAsset(preset.cornerAsset);
  
  // 计算缩放后的尺寸
  const scaledSize = Math.round(preset.cornerSize * scaleFactor);
  
  // 获取变换配置
  const transform = CORNER_TRANSFORMS[position];
  
  // 创建 sharp 实例并调整尺寸
  let image = sharp(cornerBuffer).resize(scaledSize, scaledSize, {
    fit: 'fill',
    kernel: sharp.kernel.lanczos3,
  });
  
  // 应用镜像变换
  if (transform.flipHorizontal && transform.flipVertical) {
    // 同时水平和垂直翻转 = 旋转180度
    image = image.rotate(180);
  } else if (transform.flipHorizontal) {
    image = image.flop(); // 水平翻转
  } else if (transform.flipVertical) {
    image = image.flip(); // 垂直翻转
  }
  
  return image.png().toBuffer();
}

/**
 * 渲染单条边框
 * 
 * 加载边框资源并调整到指定尺寸。
 * 对于垂直边框（左/右），需要旋转90度。
 * 
 * @param preset - 边框预设配置
 * @param position - 边框位置
 * @param length - 边框长度
 * @param scaleFactor - 缩放因子
 * @returns 渲染后的边框 Buffer
 * 
 * Requirements: 3.1, 3.2, 3.6
 */
export async function renderBorderStrip(
  preset: FramePresetConfig,
  position: BorderPosition,
  length: number,
  scaleFactor: number = 1.0
): Promise<Buffer> {
  // 加载边框资源
  const borderBuffer = await loadAsset(preset.borderAsset);
  
  // 计算缩放后的厚度
  const scaledThickness = Math.round(preset.borderThickness * scaleFactor);
  
  // 判断是水平还是垂直边框
  const isVertical = position === 'left' || position === 'right';
  
  let image: sharp.Sharp;
  
  if (isVertical) {
    // 垂直边框：先调整尺寸，然后旋转90度
    // 原始边框是水平的，需要旋转成垂直
    image = sharp(borderBuffer)
      .resize(length, scaledThickness, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .rotate(90); // 旋转90度变成垂直
  } else {
    // 水平边框：直接调整尺寸
    image = sharp(borderBuffer).resize(length, scaledThickness, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    });
  }
  
  return image.png().toBuffer();
}

/**
 * 验证预设资源文件
 * 
 * 检查预设所需的所有资源文件是否存在。
 * 
 * @param preset - 边框预设配置
 * @throws Error 如果资源文件不存在
 * 
 * Requirements: 7.4
 */
function validatePresetAssets(preset: FramePresetConfig): void {
  if (!validateAssetExists(preset.cornerAsset)) {
    throw new Error(FRAME_ERROR_MESSAGES.ASSET_NOT_FOUND(preset.cornerAsset));
  }
  if (!validateAssetExists(preset.borderAsset)) {
    throw new Error(FRAME_ERROR_MESSAGES.ASSET_NOT_FOUND(preset.borderAsset));
  }
}


/**
 * 渲染装饰边框到卡牌图片
 * 
 * 主渲染函数，将完整的装饰边框（4个角饰 + 4条边框）合成到卡牌图片上。
 * 
 * @param cardBuffer - 卡牌图片 Buffer
 * @param options - 渲染选项
 * @returns 带边框的卡牌图片 Buffer
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.4, 5.1, 5.4, 5.5, 6.2
 */
export async function renderFrame(
  cardBuffer: Buffer,
  options: FrameRenderOptions
): Promise<Buffer> {
  const { presetId, cardWidth, cardHeight, layoutVariant } = options;
  
  // 获取预设配置
  const preset = FRAME_PRESETS[presetId];
  if (!preset) {
    throw new Error(FRAME_ERROR_MESSAGES.INVALID_PRESET(presetId));
  }
  
  // 如果是 'none' 预设，直接返回原图
  if (!isDecorativePreset(presetId)) {
    return cardBuffer;
  }
  
  // 验证资源文件存在
  validatePresetAssets(preset);
  
  // 获取缩放因子
  const scaleFactor = getScaleFactorForLayout(layoutVariant);
  
  // 计算实际使用的参数（支持自定义覆盖）
  const insetOffset = options.insetOffset ?? preset.insetOffset;
  const borderThickness = options.borderThickness ?? preset.borderThickness;
  const cornerSize = Math.round(preset.cornerSize * scaleFactor);
  
  // 验证内嵌偏移量在有效范围内 (0-20 pixels，支持间隙调整)
  const effectiveInsetOffset = Math.max(0, Math.min(20, insetOffset));
  
  // 准备合成层数组
  const compositeInputs: sharp.OverlayOptions[] = [];
  
  // 渲染四个角饰
  for (const position of ALL_CORNERS) {
    const cornerBuffer = await renderCornerOrnament(preset, position, scaleFactor);
    const cornerPos = calculateCornerPosition(
      position,
      cardWidth,
      cardHeight,
      cornerSize,
      effectiveInsetOffset
    );
    
    compositeInputs.push({
      input: cornerBuffer,
      left: Math.round(cornerPos.x),
      top: Math.round(cornerPos.y),
    });
  }
  
  // 渲染四条边框
  for (const position of ALL_BORDERS) {
    const borderDims = calculateBorderPosition(
      position,
      cardWidth,
      cardHeight,
      cornerSize,
      Math.round(borderThickness * scaleFactor),
      effectiveInsetOffset
    );
    
    // 只有当边框长度大于0时才渲染
    const borderLength = position === 'top' || position === 'bottom' 
      ? borderDims.width 
      : borderDims.height;
    
    if (borderLength > 0) {
      const borderBuffer = await renderBorderStrip(
        preset,
        position,
        borderLength,
        scaleFactor
      );
      
      compositeInputs.push({
        input: borderBuffer,
        left: Math.round(borderDims.x),
        top: Math.round(borderDims.y),
      });
    }
  }
  
  // 合成所有层到卡牌图片上
  const result = await sharp(cardBuffer)
    .composite(compositeInputs)
    .png()
    .toBuffer();
  
  return result;
}

/**
 * 获取边框渲染信息
 * 
 * 返回边框渲染的详细信息，用于调试和预览。
 * 
 * @param options - 渲染选项
 * @returns 渲染信息对象
 */
export function getFrameRenderInfo(options: FrameRenderOptions): {
  preset: FramePresetConfig;
  scaleFactor: number;
  effectiveCornerSize: number;
  effectiveBorderThickness: number;
  effectiveInsetOffset: number;
  corners: Array<{ position: CornerPosition; coords: Position }>;
  borders: Array<{ position: BorderPosition; dims: BorderDimensions }>;
} {
  const { presetId, cardWidth, cardHeight, layoutVariant } = options;
  const preset = FRAME_PRESETS[presetId];
  
  if (!preset) {
    throw new Error(FRAME_ERROR_MESSAGES.INVALID_PRESET(presetId));
  }
  
  const scaleFactor = getScaleFactorForLayout(layoutVariant);
  const effectiveCornerSize = Math.round(preset.cornerSize * scaleFactor);
  const effectiveBorderThickness = Math.round(
    (options.borderThickness ?? preset.borderThickness) * scaleFactor
  );
  const effectiveInsetOffset = Math.max(
    5,
    Math.min(20, options.insetOffset ?? preset.insetOffset)
  );
  
  const corners = ALL_CORNERS.map((position) => ({
    position,
    coords: calculateCornerPosition(
      position,
      cardWidth,
      cardHeight,
      effectiveCornerSize,
      effectiveInsetOffset
    ),
  }));
  
  const borders = ALL_BORDERS.map((position) => ({
    position,
    dims: calculateBorderPosition(
      position,
      cardWidth,
      cardHeight,
      effectiveCornerSize,
      effectiveBorderThickness,
      effectiveInsetOffset
    ),
  }));
  
  return {
    preset,
    scaleFactor,
    effectiveCornerSize,
    effectiveBorderThickness,
    effectiveInsetOffset,
    corners,
    borders,
  };
}
