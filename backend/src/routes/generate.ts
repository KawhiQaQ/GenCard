import express from 'express';
import { GenerationRequest, GenerationResponse, ImageFrameElement } from '../types/index.js';
import { renderLayoutBase } from '../services/layoutRenderer.js';
import { buildAIPrompt, getPromptSummary } from '../services/promptBuilder.js';
import { generateCardWithAI, validateOpenAIConfig } from '../services/aiGenerator.js';
import { compositeImages, hasImagesToComposite, saveGeneratedImage } from '../services/imageComposer.js';
import { ValidationError, AIServiceError, asyncHandler } from '../middleware/errorHandler.js';
import { normalizeRequest, logConversion, trackConversion } from '../utils/requestConverter.js';

const router = express.Router();

/**
 * 验证新的 GenerationRequest 格式
 * 支持 PromptInput 数据结构
 */
function validateGenerationRequest(request: any): { valid: boolean; error?: string } {
  // 验证布局数据
  if (!request.layout || !request.layout.canvas || !request.layout.elements) {
    return { valid: false, error: '请求数据不完整：缺少布局信息' };
  }

  if (!Array.isArray(request.layout.elements)) {
    return { valid: false, error: '布局元素必须是数组' };
  }

  if (request.layout.elements.length === 0) {
    return { valid: false, error: '无法生成空布局的卡牌。请至少添加一个元素。' };
  }

  // 验证元素数量限制
  if (request.layout.elements.length > 50) {
    return { valid: false, error: `元素数量超过限制：${request.layout.elements.length}（最大50个）` };
  }

  // 验证画布尺寸
  const { width, height } = request.layout.canvas;
  if (width < 100 || width > 2000) {
    return { valid: false, error: '画布宽度必须在100-2000像素之间' };
  }

  if (height < 100 || height > 2000) {
    return { valid: false, error: '画布高度必须在100-2000像素之间' };
  }

  // 验证 PromptInput 数据
  if (request.promptInput) {
    // 新格式：使用 promptInput
    if (typeof request.promptInput.stylePrompt !== 'string') {
      return { valid: false, error: 'stylePrompt 必须是字符串' };
    }

    if (request.promptInput.contentPrompt !== null && typeof request.promptInput.contentPrompt !== 'string') {
      return { valid: false, error: 'contentPrompt 必须是字符串或 null' };
    }

    // 验证提示词长度
    const contentLength = request.promptInput.contentPrompt?.length || 0;
    const styleLength = request.promptInput.stylePrompt?.length || 0;
    const totalLength = contentLength + styleLength;

    if (totalLength > 2000) {
      return { valid: false, error: `提示词总长度超过限制：${totalLength}（最大2000字符）` };
    }

    if (styleLength === 0) {
      return { valid: false, error: 'stylePrompt 不能为空' };
    }
  } else if (request.prompt) {
    // 旧格式：使用单一 prompt（向后兼容）
    if (typeof request.prompt !== 'string') {
      return { valid: false, error: 'prompt 必须是字符串' };
    }

    if (request.prompt.length > 2000) {
      return { valid: false, error: `提示词长度超过限制：${request.prompt.length}（最大2000字符）` };
    }
  } else {
    return { valid: false, error: '缺少提示词数据（promptInput 或 prompt）' };
  }

  return { valid: true };
}

/**
 * POST /api/generate
 * 生成AI卡牌
 * 支持新的 PromptInput 格式和旧的 prompt 格式（向后兼容）
 * 
 * @deprecated 此端点已弃用，请使用 /api/v2/generate 以获得更好的生成效果
 */
router.post('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  // 添加弃用警告头
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Deprecation-Message', 'This endpoint is deprecated. Please use /api/v2/generate for better results with ControlNet + Qwen-Image.');
  res.setHeader('X-API-Deprecation-Date', '2026-01-12');
  
  // 记录弃用警告
  console.warn('⚠️  DEPRECATION WARNING: /api/generate endpoint is being used. Please migrate to /api/v2/generate');
  
  // 验证OpenAI配置
  const configValidation = validateOpenAIConfig();
  if (!configValidation.valid) {
    throw new AIServiceError(
      `OpenAI配置错误: ${configValidation.error}。请在.env文件中设置有效的OPENAI_API_KEY。`,
      503
    );
  }
  
  // 解析请求体
  const request: any = req.body;
  
  // 验证请求数据（支持新旧格式）
  const validation = validateGenerationRequest(request);
  if (!validation.valid) {
    throw new ValidationError(validation.error!);
  }
  
  // 使用转换器规范化请求格式
  const conversion = normalizeRequest(request);
  const normalizedRequest = conversion.request;
  
  // 记录转换详情
  logConversion(conversion, '/api/generate');
  trackConversion(conversion);
  
  // 如果使用了旧格式，额外记录警告
  if (conversion.wasConverted) {
    console.warn('⚠️  Legacy request format detected and converted. Please update client to use new format.');
  }
  
  console.log('=== Starting card generation ===');
  console.log('Canvas size:', `${normalizedRequest.layout.canvas.width}x${normalizedRequest.layout.canvas.height}`);
  console.log('Elements count:', normalizedRequest.layout.elements.length);
  console.log('Content prompt:', normalizedRequest.promptInput.contentPrompt || '(none)');
  console.log('Style prompt:', normalizedRequest.promptInput.stylePrompt);
  
  // 检测是否有上传的图片
  const imageFrames = normalizedRequest.layout.elements.filter(e => e.type === 'imageframe') as ImageFrameElement[];
  const hasUploadedImages = imageFrames.some(frame => frame.uploadedImage?.id);
  console.log('Has uploaded images:', hasUploadedImages);
  
  try {
    // 步骤1: 渲染布局基础图（用于参考，虽然DALL-E 3不直接使用）
    console.log('Step 1: Rendering layout base...');
    const layoutBase = await renderLayoutBase(normalizedRequest.layout);
    console.log('Layout base rendered, size:', layoutBase.length, 'bytes');
    
    // 步骤2: 构建AI Prompt（使用旧的 buildAIPrompt 保持兼容）
    console.log('Step 2: Building AI prompt...');
    // 为了兼容旧的 buildAIPrompt，我们需要构造一个兼容的请求对象
    const legacyRequest = {
      layout: normalizedRequest.layout,
      prompt: normalizedRequest.promptInput.stylePrompt,
      preserveBorders: true,
      uploadedImages: hasUploadedImages ? imageFrames
        .filter(f => f.uploadedImage)
        .map(f => ({
          frameId: f.id,
          imageUrl: f.uploadedImage!.url
        })) : []
    };
    const aiPrompt = buildAIPrompt(legacyRequest as any);
    console.log('AI Prompt:', getPromptSummary(aiPrompt));
    console.log('Full prompt length:', aiPrompt.length, 'characters');
    
    // 步骤3: 调用AI生成
    console.log('Step 3: Calling AI generation service...');
    const generatedImage = await generateCardWithAI(aiPrompt, normalizedRequest.layout);
    console.log('AI generation completed');
    
    // 步骤4: 图像合成（如果需要）
    let finalImageUrl: string;
    
    if (hasImagesToComposite(legacyRequest as any)) {
      console.log('Step 4: Compositing uploaded images...');
      finalImageUrl = await compositeImages(generatedImage, legacyRequest as any);
    } else {
      console.log('Step 4: Saving generated image (no composition needed)...');
      finalImageUrl = await saveGeneratedImage(generatedImage);
    }
    
    // 计算生成时间
    const generationTime = (Date.now() - startTime) / 1000;
    console.log(`=== Generation completed in ${generationTime.toFixed(2)}s ===`);
    console.log('Result URL:', finalImageUrl);
    
    // 返回成功响应
    res.json({
      success: true,
      imageUrl: finalImageUrl,
      generationTime: parseFloat(generationTime.toFixed(2))
    } as GenerationResponse);
    
  } catch (error: any) {
    const generationTime = (Date.now() - startTime) / 1000;
    console.error('=== Generation failed ===');
    console.error('Error:', error.message);
    console.error('Time elapsed:', generationTime.toFixed(2), 's');
    
    // 重新抛出错误，让错误处理中间件处理
    throw error;
  }
}));

/**
 * GET /api/generate/status
 * 检查生成服务状态
 * 
 * @deprecated 此端点已弃用，请使用 /api/v2/generate/status
 */
router.get('/status', (_req, res) => {
  const configValidation = validateOpenAIConfig();
  
  res.setHeader('X-API-Deprecated', 'true');
  res.setHeader('X-API-Deprecation-Message', 'This endpoint is deprecated. Please use /api/v2/generate/status');
  
  res.json({
    available: configValidation.valid,
    error: configValidation.error,
    message: configValidation.valid 
      ? 'AI generation service is ready' 
      : 'AI generation service is not properly configured',
    deprecated: true,
    deprecationMessage: 'This endpoint is deprecated. Please use /api/v2/generate/status'
  });
});

export default router;

/**
 * GET /api/generate/conversion-stats
 * 获取请求格式转换统计信息（用于监控迁移进度）
 */
router.get('/conversion-stats', (_req, res) => {
  const { getConversionStats } = require('../utils/requestConverter.js');
  const stats = getConversionStats();
  
  res.json({
    ...stats,
    message: 'Request format conversion statistics',
    recommendation: stats.legacyRequests > 0 
      ? 'Legacy format requests detected. Please migrate clients to use /api/v2/generate with new format.'
      : 'All requests are using the new format.'
  });
});
