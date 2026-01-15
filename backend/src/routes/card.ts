import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { CardBackgroundRequest, CardBackgroundResponse, LayoutMode, LayoutVariant, TextureType, BlurIntensity, GlowIntensity, ScalePreset } from '../types/index.js';
import { generateFromText, ModelInferenceError } from '../services/qwenGenerator.js';
import { composeCard, getLayoutConfig, getLayoutConfigByVariant, getLayoutModeFromVariant, PREMIUM_TEXTBOX_COLORS } from '../services/cardComposer.js';
import { BORDER_PRESETS, GLOW_PRESETS } from '../services/borderRenderer.js';
import { TEXTURE_PRESETS, isValidTextureType } from '../services/textureConfig.js';
import { BLUR_PRESETS, isValidBlurIntensity } from '../services/blurConfig.js';
import { SCALE_PRESETS, isValidScalePreset } from '../services/scaleConfig.js';
import { ValidationError, AIServiceError, asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 背景生成 Prompt 优化常量
const BACKGROUND_PROMPT_PREFIX = 'photorealistic background, cinematic lighting, epic atmosphere, wide angle view, detailed environment, no people, no faces, no characters, ';
const BACKGROUND_NEGATIVE_PROMPT = 'person, face, human, character, portrait, figure, body, hand, eye, cartoon, anime, illustration, childish, toy-like, flat colors, simple shading, low quality, blurry, distorted, ugly, deformed, text, watermark';

// 有效的布局模式
const VALID_LAYOUT_MODES: LayoutMode[] = ['landscape', 'portrait'];

// 有效的布局变体（4选1）
const VALID_LAYOUT_VARIANTS: LayoutVariant[] = ['landscape-square', 'landscape-flat', 'portrait-square', 'portrait-flat'];

// 有效的边框预设
const VALID_BORDER_PRESETS = ['gold', 'silver', 'bronze'] as const;

// 有效的纹理类型
const VALID_TEXTURE_TYPES: TextureType[] = ['matte-paper', 'silk', 'ink-wash', 'none'];

// 有效的模糊强度
const VALID_BLUR_INTENSITIES: BlurIntensity[] = ['light', 'medium', 'strong'];

// 有效的外发光强度
const VALID_GLOW_INTENSITIES: GlowIntensity[] = ['subtle', 'medium', 'strong', 'none'];

// 有效的缩放预设
// Requirements: 7.1, 7.2, 7.3 - 提供五个预设级别：标准(100%)、适中(95%)、紧凑(90%)、精简(80%)、迷你(70%)
const VALID_SCALE_PRESETS: ScalePreset[] = ['standard', 'moderate', 'compact', 'slim', 'mini'];

/**
 * 验证卡牌背景生成请求
 */
function validateCardBackgroundRequest(request: any): { valid: boolean; error?: string } {
  if (!request.artworkUrl || typeof request.artworkUrl !== 'string') {
    return { valid: false, error: '缺少原画图片 URL' };
  }

  if (!request.backgroundPrompt || typeof request.backgroundPrompt !== 'string') {
    return { valid: false, error: '缺少背景风格提示词' };
  }

  if (request.backgroundPrompt.trim().length === 0) {
    return { valid: false, error: '背景风格提示词不能为空' };
  }

  if (request.backgroundPrompt.length > 1000) {
    return { valid: false, error: `提示词长度超过限制：${request.backgroundPrompt.length}（最大1000字符）` };
  }

  // 验证文本框配置（可选）
  if (request.textBoxes && !Array.isArray(request.textBoxes)) {
    return { valid: false, error: '文本框配置格式错误' };
  }

  // 验证布局变体（可选，优先于 layoutMode）- Requirements: 6.8
  if (request.layoutVariant !== undefined) {
    if (typeof request.layoutVariant !== 'string') {
      return { valid: false, error: '布局变体格式错误' };
    }
    if (!VALID_LAYOUT_VARIANTS.includes(request.layoutVariant as LayoutVariant)) {
      return { valid: false, error: `无效的布局变体：${request.layoutVariant}，有效值为 ${VALID_LAYOUT_VARIANTS.join(', ')}` };
    }
  }

  // 验证布局模式（可选，默认 landscape）
  if (request.layoutMode !== undefined) {
    if (typeof request.layoutMode !== 'string') {
      return { valid: false, error: '布局模式格式错误' };
    }
    if (!VALID_LAYOUT_MODES.includes(request.layoutMode as LayoutMode)) {
      return { valid: false, error: `无效的布局模式：${request.layoutMode}，有效值为 landscape 或 portrait` };
    }
  }

  // 验证文本框底色 ID（可选，默认 obsidian）
  if (request.textBoxColorId !== undefined) {
    if (typeof request.textBoxColorId !== 'string') {
      return { valid: false, error: '文本框底色 ID 格式错误' };
    }
    const validColorIds = PREMIUM_TEXTBOX_COLORS.map(c => c.id);
    if (!validColorIds.includes(request.textBoxColorId)) {
      return { valid: false, error: `无效的文本框底色 ID：${request.textBoxColorId}，有效值为 ${validColorIds.join(', ')}` };
    }
  }

  // 验证边框预设（可选）
  if (request.borderPreset !== undefined) {
    if (typeof request.borderPreset !== 'string') {
      return { valid: false, error: '边框预设格式错误' };
    }
    if (!VALID_BORDER_PRESETS.includes(request.borderPreset as typeof VALID_BORDER_PRESETS[number])) {
      return { valid: false, error: `无效的边框预设：${request.borderPreset}，有效值为 ${VALID_BORDER_PRESETS.join(', ')}` };
    }
  }

  // 验证纹理类型（可选，默认 matte-paper）- Requirements: 1.1
  if (request.textureType !== undefined) {
    if (typeof request.textureType !== 'string') {
      return { valid: false, error: '纹理类型格式错误' };
    }
    if (!VALID_TEXTURE_TYPES.includes(request.textureType as TextureType)) {
      return { valid: false, error: `无效的纹理类型：${request.textureType}，有效值为 ${VALID_TEXTURE_TYPES.join(', ')}` };
    }
  }

  // 验证模糊强度（可选，默认 medium）- Requirements: 3.2
  if (request.blurIntensity !== undefined) {
    if (typeof request.blurIntensity !== 'string') {
      return { valid: false, error: '模糊强度格式错误' };
    }
    if (!VALID_BLUR_INTENSITIES.includes(request.blurIntensity as BlurIntensity)) {
      return { valid: false, error: `无效的模糊强度：${request.blurIntensity}，有效值为 ${VALID_BLUR_INTENSITIES.join(', ')}` };
    }
  }

  // 验证外发光强度（可选，默认 medium）- Requirements: 5.3
  if (request.glowIntensity !== undefined) {
    if (typeof request.glowIntensity !== 'string') {
      return { valid: false, error: '外发光强度格式错误' };
    }
    if (!VALID_GLOW_INTENSITIES.includes(request.glowIntensity as GlowIntensity)) {
      return { valid: false, error: `无效的外发光强度：${request.glowIntensity}，有效值为 ${VALID_GLOW_INTENSITIES.join(', ')}` };
    }
  }

  // 验证缩放预设（可选，默认 standard）- Requirements: 7.5
  if (request.scalePreset !== undefined) {
    if (typeof request.scalePreset !== 'string') {
      return { valid: false, error: '缩放预设格式错误' };
    }
    if (!VALID_SCALE_PRESETS.includes(request.scalePreset as ScalePreset)) {
      return { valid: false, error: `无效的缩放预设：${request.scalePreset}，有效值为 ${VALID_SCALE_PRESETS.join(', ')}` };
    }
  }

  return { valid: true };
}

/**
 * 下载图片并转换为 Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  console.log('下载图片:', url);

  // 处理本地路径
  if (url.startsWith('/')) {
    const localPath = path.join(__dirname, '..', '..', url);
    console.log('本地路径:', localPath);

    if (!fs.existsSync(localPath)) {
      throw new Error(`本地图片不存在: ${url}`);
    }

    const buffer = fs.readFileSync(localPath);
    console.log('本地图片读取成功，大小:', buffer.length, 'bytes');

    // 验证图片数据有效性
    if (buffer.length === 0) {
      throw new Error(`本地图片文件为空: ${url}`);
    }

    return buffer;
  }

  // 处理远程 URL
  console.log('下载远程图片...');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log('远程图片下载成功，大小:', buffer.length, 'bytes');

  // 验证图片数据有效性
  if (buffer.length === 0) {
    throw new Error(`下载的图片数据为空: ${url}`);
  }

  return buffer;
}

/**
 * POST /api/card/generate-background
 * 生成卡牌背景并合成最终卡牌
 * 
 * 简化流程：
 * 1. 调用文生图 API 生成背景（卡牌尺寸 1024x768）
 * 2. 使用 cardComposer 合成最终卡牌（背景 + 原画 + 文本框 + 文字）
 */
router.post('/generate-background', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const request: CardBackgroundRequest = req.body;

  // 验证请求
  const validation = validateCardBackgroundRequest(request);
  if (!validation.valid) {
    throw new ValidationError(validation.error!);
  }

  // 获取布局变体（优先）或布局模式（向后兼容）
  const layoutVariant: LayoutVariant | undefined = request.layoutVariant;
  const layoutMode: LayoutMode = layoutVariant 
    ? getLayoutModeFromVariant(layoutVariant)
    : (request.layoutMode || 'landscape');
  
  // 根据布局变体或模式获取布局配置
  const layoutConfig = layoutVariant 
    ? getLayoutConfigByVariant(layoutVariant)
    : getLayoutConfig(layoutMode);

  // 获取文本框底色 ID（默认 obsidian）
  const textBoxColorId = request.textBoxColorId || 'obsidian';

  // 获取边框预设
  const borderPreset = request.borderPreset;

  // 获取视觉增强选项（可选，使用默认值）
  const textureType: TextureType = request.textureType || 'matte-paper';
  const blurIntensity: BlurIntensity = request.blurIntensity || 'medium';
  const glowIntensity: GlowIntensity = request.glowIntensity || 'medium';
  const scalePreset: ScalePreset = request.scalePreset || 'standard';

  console.log('=== 开始卡牌背景生成 ===');
  console.log('原画 URL:', request.artworkUrl);
  console.log('背景提示词:', request.backgroundPrompt);
  console.log('布局变体:', layoutVariant || '未指定');
  console.log('布局模式:', layoutMode);
  console.log('文本框底色 ID:', textBoxColorId);
  console.log('边框预设:', borderPreset || '默认');
  console.log('纹理类型:', textureType);
  console.log('模糊强度:', blurIntensity);
  console.log('外发光强度:', glowIntensity);
  console.log('缩放预设:', scalePreset);
  console.log('文本框数量:', request.textBoxes?.length || 0);

  try {
    // Step 1: 下载原画
    console.log('Step 1: 下载原画...');
    const artworkBuffer = await downloadImage(request.artworkUrl);
    console.log('原画下载完成，大小:', artworkBuffer.length, 'bytes');

    // 验证原画数据
    if (!artworkBuffer || artworkBuffer.length === 0) {
      throw new Error('原画图像数据无效');
    }

    // Step 2: 调用文生图 API 生成背景（使用布局对应的画布尺寸）
    console.log('Step 2: 调用文生图 API 生成背景...');

    // 优化背景提示词：添加背景专用前缀，确保生成纯背景而非人物图
    const optimizedBackgroundPrompt = BACKGROUND_PROMPT_PREFIX + request.backgroundPrompt;
    console.log('优化后的背景提示词:', optimizedBackgroundPrompt);

    const backgroundBuffer = await generateFromText(
      optimizedBackgroundPrompt,
      {
        width: layoutConfig.canvas.width,
        height: layoutConfig.canvas.height,
        negativePrompt: BACKGROUND_NEGATIVE_PROMPT,
        skipPromptEnhancement: true  // 跳过提示词增强，使用纯背景提示词
      }
    );
    console.log('背景生成完成，大小:', backgroundBuffer.length, 'bytes');

    // Step 3: 使用 cardComposer 合成最终卡牌
    console.log('Step 3: 合成最终卡牌...');
    const composedCardBuffer = await composeCard({
      backgroundBuffer,
      artworkBuffer,
      textBoxes: request.textBoxes || [],
      textBoxColorId,
      layoutMode,
      layoutVariant,  // 优先使用 layoutVariant - Requirements: 1.2, 1.3
      borderPreset,
      textureType,
      blurIntensity,
      glowIntensity,
      scalePreset
    });
    console.log('卡牌合成完成');

    // Step 4: 保存生成的图像
    console.log('Step 4: 保存生成的图像...');
    const generatedDir = path.join(__dirname, '..', '..', 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const fileName = `card_${uuidv4()}.png`;
    const filePath = path.join(generatedDir, fileName);
    fs.writeFileSync(filePath, composedCardBuffer);

    const imageUrl = `/generated/${fileName}`;
    const generationTime = (Date.now() - startTime) / 1000;

    console.log('=== 卡牌背景生成完成 ===');
    console.log('生成时间:', generationTime.toFixed(2), 's');
    console.log('图像 URL:', imageUrl);

    const response: CardBackgroundResponse = {
      success: true,
      imageUrl,
      generationTime: parseFloat(generationTime.toFixed(2))
    };

    res.json(response);

  } catch (error: any) {
    const generationTime = (Date.now() - startTime) / 1000;
    console.error('=== 卡牌背景生成失败 ===');
    console.error('错误:', error.message);
    console.error('耗时:', generationTime.toFixed(2), 's');

    if (error instanceof ModelInferenceError) {
      throw new AIServiceError(error.getUserMessage(), error.statusCode || 500);
    }

    throw error;
  }
}));

/**
 * GET /api/card/status
 * 检查卡牌生成服务状态
 */
router.get('/status', (_req, res) => {
  const hasApiKey = !!process.env.DASHSCOPE_API_KEY;
  const hasOssConfig = !!(
    process.env.ALIYUN_OSS_ACCESS_KEY_ID &&
    process.env.ALIYUN_OSS_ACCESS_KEY_SECRET &&
    process.env.ALIYUN_OSS_BUCKET
  );

  res.json({
    available: hasApiKey && hasOssConfig,
    message: hasApiKey && hasOssConfig
      ? '卡牌背景生成服务已就绪'
      : '卡牌背景生成服务未完全配置',
    details: {
      dashscopeApiKey: hasApiKey ? '已配置' : '未配置',
      ossConfig: hasOssConfig ? '已配置' : '未配置'
    },
    layouts: {
      landscape: getLayoutConfig('landscape'),
      portrait: getLayoutConfig('portrait')
    },
    layoutVariants: VALID_LAYOUT_VARIANTS,
    textBoxColors: PREMIUM_TEXTBOX_COLORS.map(c => ({ id: c.id, name: c.name })),
    borderPresets: VALID_BORDER_PRESETS,
    // 视觉增强选项
    visualEnhancements: {
      textureTypes: VALID_TEXTURE_TYPES,
      blurIntensities: VALID_BLUR_INTENSITIES,
      glowIntensities: VALID_GLOW_INTENSITIES,
      scalePresets: VALID_SCALE_PRESETS
    }
  });
});

export default router;
