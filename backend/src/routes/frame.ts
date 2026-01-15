/**
 * Frame API Routes - 边框 API 路由
 * 
 * 本文件实现了装饰边框系统的 API 端点。
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { LayoutVariant } from '../types/index.js';
import { ApplyFrameRequest, ApplyFrameResponse, FramePresetId } from '../types/frame.js';
import { renderFrame } from '../services/frameRenderer.js';
import { FRAME_PRESETS, isValidPresetId, getPresetPreviews, FRAME_ERROR_MESSAGES } from '../services/framePresets.js';
import { ValidationError, asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 有效的布局变体
const VALID_LAYOUT_VARIANTS: LayoutVariant[] = [
  'landscape-square',
  'landscape-flat',
  'portrait-square',
  'portrait-flat',
];

/**
 * 获取布局对应的画布尺寸
 */
function getCanvasDimensions(layoutVariant: LayoutVariant): { width: number; height: number } {
  if (layoutVariant.startsWith('portrait')) {
    return { width: 768, height: 1024 };
  }
  return { width: 1024, height: 768 };
}

/**
 * 验证应用边框请求
 * 
 * Requirements: 6.4
 */
function validateApplyFrameRequest(request: any): { valid: boolean; error?: string } {
  // 验证卡牌图片 URL
  if (!request.cardImageUrl || typeof request.cardImageUrl !== 'string') {
    return { valid: false, error: '缺少卡牌图片 URL (cardImageUrl)' };
  }

  if (request.cardImageUrl.trim().length === 0) {
    return { valid: false, error: '卡牌图片 URL 不能为空' };
  }

  // 验证边框预设 ID
  if (!request.framePresetId || typeof request.framePresetId !== 'string') {
    return { valid: false, error: '缺少边框预设 ID (framePresetId)' };
  }

  if (!isValidPresetId(request.framePresetId)) {
    return { valid: false, error: FRAME_ERROR_MESSAGES.INVALID_PRESET(request.framePresetId) };
  }

  // 验证布局变体
  if (!request.layoutVariant || typeof request.layoutVariant !== 'string') {
    return { valid: false, error: '缺少布局变体 (layoutVariant)' };
  }

  if (!VALID_LAYOUT_VARIANTS.includes(request.layoutVariant as LayoutVariant)) {
    return {
      valid: false,
      error: `无效的布局变体：${request.layoutVariant}，有效值为 ${VALID_LAYOUT_VARIANTS.join(', ')}`,
    };
  }

  // 验证可选参数：内嵌偏移量（支持间隙调整，范围扩展为 0-20）
  if (request.insetOffset !== undefined) {
    if (typeof request.insetOffset !== 'number') {
      return { valid: false, error: '内嵌偏移量 (insetOffset) 必须是数字' };
    }
    if (request.insetOffset < 0 || request.insetOffset > 20) {
      return { valid: false, error: '内嵌偏移量 (insetOffset) 必须在 0-20 像素范围内' };
    }
  }

  // 验证可选参数：边框厚度
  if (request.borderThickness !== undefined) {
    if (typeof request.borderThickness !== 'number') {
      return { valid: false, error: '边框厚度 (borderThickness) 必须是数字' };
    }
    if (request.borderThickness < 15 || request.borderThickness > 30) {
      return { valid: false, error: '边框厚度 (borderThickness) 必须在 15-30 像素范围内' };
    }
  }

  return { valid: true };
}

/**
 * 下载图片并转换为 Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  console.log('下载卡牌图片:', url);

  // 处理本地路径
  if (url.startsWith('/')) {
    const localPath = path.join(__dirname, '..', '..', url);
    console.log('本地路径:', localPath);

    if (!fs.existsSync(localPath)) {
      throw new Error(FRAME_ERROR_MESSAGES.CARD_DOWNLOAD_FAILED(url));
    }

    const buffer = fs.readFileSync(localPath);
    console.log('本地图片读取成功，大小:', buffer.length, 'bytes');

    if (buffer.length === 0) {
      throw new Error(FRAME_ERROR_MESSAGES.CARD_DOWNLOAD_FAILED(url));
    }

    return buffer;
  }

  // 处理远程 URL
  console.log('下载远程图片...');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(FRAME_ERROR_MESSAGES.CARD_DOWNLOAD_FAILED(url));
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log('远程图片下载成功，大小:', buffer.length, 'bytes');

  if (buffer.length === 0) {
    throw new Error(FRAME_ERROR_MESSAGES.CARD_DOWNLOAD_FAILED(url));
  }

  return buffer;
}

/**
 * POST /api/card/apply-frame
 * 应用装饰边框到卡牌图片
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
router.post('/apply-frame', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const request: ApplyFrameRequest = req.body;

  // 验证请求
  const validation = validateApplyFrameRequest(request);
  if (!validation.valid) {
    throw new ValidationError(validation.error!);
  }

  const { cardImageUrl, framePresetId, layoutVariant, insetOffset, borderThickness } = request;

  console.log('=== 开始应用装饰边框 ===');
  console.log('卡牌图片 URL:', cardImageUrl);
  console.log('边框预设:', framePresetId);
  console.log('布局变体:', layoutVariant);
  console.log('自定义内嵌偏移:', insetOffset ?? '使用预设默认值');
  console.log('自定义边框厚度:', borderThickness ?? '使用预设默认值');

  try {
    // 下载卡牌图片
    console.log('Step 1: 下载卡牌图片...');
    const cardBuffer = await downloadImage(cardImageUrl);

    // 获取画布尺寸
    const { width: cardWidth, height: cardHeight } = getCanvasDimensions(layoutVariant);

    // 渲染边框
    console.log('Step 2: 渲染装饰边框...');
    const framedCardBuffer = await renderFrame(cardBuffer, {
      presetId: framePresetId as FramePresetId,
      cardWidth,
      cardHeight,
      layoutVariant,
      insetOffset,
      borderThickness,
    });
    console.log('边框渲染完成');

    // 保存生成的图像
    console.log('Step 3: 保存带边框的卡牌图片...');
    const generatedDir = path.join(__dirname, '..', '..', 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const fileName = `card_framed_${uuidv4()}.png`;
    const filePath = path.join(generatedDir, fileName);
    fs.writeFileSync(filePath, framedCardBuffer);

    const imageUrl = `/generated/${fileName}`;
    const processingTime = (Date.now() - startTime) / 1000;

    console.log('=== 装饰边框应用完成 ===');
    console.log('处理时间:', processingTime.toFixed(2), 's');
    console.log('图像 URL:', imageUrl);

    const response: ApplyFrameResponse = {
      success: true,
      imageUrl,
    };

    res.json(response);

  } catch (error: any) {
    const processingTime = (Date.now() - startTime) / 1000;
    console.error('=== 装饰边框应用失败 ===');
    console.error('错误:', error.message);
    console.error('耗时:', processingTime.toFixed(2), 's');

    throw error;
  }
}));

/**
 * GET /api/card/frame-presets
 * 获取所有可用的边框预设列表
 * 
 * Requirements: 1.1, 1.4
 */
router.get('/frame-presets', (_req, res) => {
  const presets = getPresetPreviews();
  
  res.json({
    success: true,
    presets,
    count: presets.length,
  });
});

/**
 * GET /api/card/frame-preset/:id
 * 获取指定边框预设的详细信息
 * 
 * Requirements: 1.1
 */
router.get('/frame-preset/:id', (req, res) => {
  const { id } = req.params;

  if (!isValidPresetId(id)) {
    res.status(400).json({
      success: false,
      error: FRAME_ERROR_MESSAGES.INVALID_PRESET(id),
    });
    return;
  }

  const preset = FRAME_PRESETS[id as FramePresetId];

  res.json({
    success: true,
    preset: {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      cornerSize: preset.cornerSize,
      borderThickness: preset.borderThickness,
      insetOffset: preset.insetOffset,
      colorScheme: preset.colorScheme,
    },
  });
});

export default router;
