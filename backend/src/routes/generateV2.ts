import express from 'express';
import { GenerationRequest, GenerationResponse } from '../types/index.js';
import { renderLayoutSketch, SketchRenderError } from '../services/layoutRenderService.js';
import { createPreprocessor, createDefaultOptions, PreprocessorError } from '../services/controlnetPreprocessor.js';
import { buildPrompt, hasUploadedImages as detectUploadedImages } from '../services/promptBuilder.js';
import { generate as generateWithQwen, getDefaultGenerationConfig, validateApiKey, ModelInferenceError } from '../services/qwenGenerator.js';
import { ValidationError, AIServiceError, ImageProcessingError, asyncHandler } from '../middleware/errorHandler.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

/**
 * 验证 base64 图像格式
 */
function validateBase64Image(base64String: string): { valid: boolean; error?: string } {
  // 检查是否为 data URL 格式
  if (!base64String.startsWith('data:image/')) {
    return { valid: false, error: 'layoutImage 格式无效：必须是 data URL 格式' };
  }

  // 检查是否为 PNG 格式
  if (!base64String.startsWith('data:image/png;base64,')) {
    return { valid: false, error: 'layoutImage 格式无效：仅支持 PNG 格式' };
  }

  // 提取 base64 数据部分
  const base64Data = base64String.replace(/^data:image\/png;base64,/, '');
  
  // 检查 base64 数据是否为空
  if (!base64Data || base64Data.length === 0) {
    return { valid: false, error: 'layoutImage 数据为空' };
  }

  // 验证 base64 字符集
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(base64Data)) {
    return { valid: false, error: 'layoutImage 包含无效的 base64 字符' };
  }

  // 检查数据大小（限制为 10MB）
  const estimatedSize = (base64Data.length * 3) / 4;
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (estimatedSize > maxSize) {
    return { valid: false, error: `layoutImage 数据过大：${(estimatedSize / 1024 / 1024).toFixed(2)}MB（最大10MB）` };
  }

  return { valid: true };
}

/**
 * 验证 GenerationRequest 格式
 */
function validateGenerationRequest(request: any): { valid: boolean; error?: string } {
  // 验证布局数据
  if (!request.layout || !request.layout.canvas || !request.layout.elements) {
    return { valid: false, error: '请求数据不完整：缺少布局信息' };
  }

  if (!Array.isArray(request.layout.elements)) {
    return { valid: false, error: '布局元素必须是数组' };
  }

  // 验证 PromptInput 数据（在检查元素之前）
  if (!request.promptInput) {
    return { valid: false, error: '缺少提示词数据（promptInput）' };
  }

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

  // 验证元素
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

  // 验证 layoutImage（如果提供）
  if (request.layout.layoutImage !== undefined && request.layout.layoutImage !== null) {
    if (typeof request.layout.layoutImage !== 'string') {
      return { valid: false, error: 'layoutImage 必须是字符串' };
    }
    
    const imageValidation = validateBase64Image(request.layout.layoutImage);
    if (!imageValidation.valid) {
      return imageValidation;
    }
  }

  return { valid: true };
}

/**
 * 构建上传图片映射
 */
async function buildUploadedImagesMap(layout: any): Promise<Map<string, string>> {
  const uploadedImages = new Map<string, string>();
  const uploadDir = process.env.UPLOAD_DIR || './uploads';

  for (const element of layout.elements) {
    if (element.type === 'imageframe' && element.uploadedImage?.id) {
      // 构建图片文件路径
      const imagePath = path.join(uploadDir, element.uploadedImage.id);
      
      // 检查文件是否存在
      try {
        await fs.access(imagePath);
        uploadedImages.set(element.id, imagePath);
      } catch {
        console.warn(`Uploaded image not found: ${imagePath}`);
      }
    }
  }

  return uploadedImages;
}

/**
 * 保存生成的图像
 */
async function saveGeneratedImage(imageBuffer: Buffer): Promise<string> {
  const generatedDir = process.env.GENERATED_DIR || './generated';
  
  // 确保目录存在
  try {
    await fs.access(generatedDir);
  } catch {
    await fs.mkdir(generatedDir, { recursive: true });
  }

  // 生成文件名
  const filename = `card_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
  const filepath = path.join(generatedDir, filename);

  // 保存文件
  await fs.writeFile(filepath, imageBuffer);

  // 返回 URL
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  return `${serverUrl}/generated/${filename}`;
}

/**
 * POST /api/v2/generate
 * 使用 ControlNet + Qwen-Image 生成卡牌
 */
router.post('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const metrics = {
    sketchRenderTime: 0,
    preprocessTime: 0,
    promptBuildTime: 0,
    generationTime: 0,
    saveTime: 0,
    totalTime: 0
  };

  try {
    // 先验证请求数据（在检查 API 密钥之前）
    const request: GenerationRequest = req.body;
    const validation = validateGenerationRequest(request);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // 然后验证 API 密钥
    try {
      validateApiKey();
    } catch (error) {
      throw new AIServiceError(
        'Qwen API 未配置。请在.env文件中设置 DASHSCOPE_API_KEY。',
        503
      );
    }

    console.log('=== Starting Qwen-based card generation ===');
    console.log('Canvas size:', `${request.layout.canvas.width}x${request.layout.canvas.height}`);
    console.log('Elements count:', request.layout.elements.length);
    console.log('Content prompt:', request.promptInput.contentPrompt || '(none)');
    console.log('Style prompt:', request.promptInput.stylePrompt);

    // 检测是否有上传的图片
    const hasUploadedImages = detectUploadedImages(request.layout);
    console.log('Has uploaded images:', hasUploadedImages);

    // 步骤1: 获取布局草图（优先使用前端传来的 layoutImage）
    console.log('Step 1: Getting layout sketch...');
    let sketchStartTime = Date.now();
    
    const uploadedImages = await buildUploadedImagesMap(request.layout);
    let sketchImage: Buffer;
    
    // 优先使用前端传来的 layoutImage
    if (request.layout.layoutImage) {
      console.log('Using frontend-rendered layout image');
      try {
        // 解码 base64 获取图像 Buffer
        const base64Data = request.layout.layoutImage.replace(/^data:image\/png;base64,/, '');
        sketchImage = Buffer.from(base64Data, 'base64');
        metrics.sketchRenderTime = Date.now() - sketchStartTime;
        console.log(`Frontend image decoded in ${metrics.sketchRenderTime}ms, size: ${sketchImage.length} bytes`);
      } catch (error) {
        console.error('Failed to decode frontend layoutImage, falling back to server render:', error);
        // 解码失败，回退到服务端渲染
        try {
          sketchImage = await renderLayoutSketch(request.layout, uploadedImages);
          metrics.sketchRenderTime = Date.now() - sketchStartTime;
          console.log(`Fallback: Sketch rendered in ${metrics.sketchRenderTime}ms, size: ${sketchImage.length} bytes`);
        } catch (renderError) {
          if (renderError instanceof SketchRenderError) {
            throw new ImageProcessingError(`草图渲染失败: ${renderError.message}`);
          }
          throw renderError;
        }
      }
    } else {
      // 后备：服务端渲染
      console.log('Using server-rendered layout image (fallback)');
      try {
        sketchImage = await renderLayoutSketch(request.layout, uploadedImages);
        metrics.sketchRenderTime = Date.now() - sketchStartTime;
        console.log(`Sketch rendered in ${metrics.sketchRenderTime}ms, size: ${sketchImage.length} bytes`);
      } catch (error) {
        if (error instanceof SketchRenderError) {
          throw new ImageProcessingError(`草图渲染失败: ${error.message}`);
        }
        throw error;
      }
    }

    // 步骤2: ControlNet 预处理（可选，涂鸦作画模型不需要 Canny 预处理）
    console.log('Step 2: Preprocessing sketch with ControlNet...');
    let preprocessStartTime = Date.now();
    
    const preprocessor = createPreprocessor();
    const preprocessMethod = (process.env.CONTROLNET_PREPROCESSOR as any) || 'canny';
    const preprocessOptions = createDefaultOptions(preprocessMethod);
    
    let preprocessedImage: Buffer;
    try {
      preprocessedImage = await preprocessor.preprocess(sketchImage, preprocessOptions);
      metrics.preprocessTime = Date.now() - preprocessStartTime;
      console.log(`Preprocessing completed in ${metrics.preprocessTime}ms`);
    } catch (error) {
      if (error instanceof PreprocessorError) {
        throw new ImageProcessingError(`预处理失败: ${error.message}`);
      }
      throw error;
    }

    // 步骤3: 构建提示词
    console.log('Step 3: Building prompt...');
    let promptStartTime = Date.now();
    
    const prompt = buildPrompt(
      request.promptInput.contentPrompt,
      request.promptInput.stylePrompt,
      request.layout,
      hasUploadedImages
    );
    
    metrics.promptBuildTime = Date.now() - promptStartTime;
    console.log('Prompt built:', prompt.substring(0, 100) + '...');
    console.log('Full prompt length:', prompt.length, 'characters');

    // 步骤4: 调用 Qwen-Image 生成
    console.log('Step 4: Generating image with Qwen...');
    let generationStartTime = Date.now();
    
    const generationConfig = getDefaultGenerationConfig(
      request.layout.canvas.width,
      request.layout.canvas.height
    );
    
    // 如果有上传图片，增加 ControlNet 强度
    if (hasUploadedImages) {
      generationConfig.controlnetScale = 1.5;
      console.log('Increased ControlNet scale to 1.5 for uploaded images');
    }
    
    let generatedImage: Buffer;
    try {
      // 注意：涂鸦作画模型 (wanx-sketch-to-image-v1) 需要原始草图，不需要 Canny 预处理
      // 因此这里传入 sketchImage 而不是 preprocessedImage
      generatedImage = await generateWithQwen(sketchImage, prompt, generationConfig);
      metrics.generationTime = Date.now() - generationStartTime;
      console.log(`Image generated in ${metrics.generationTime}ms`);
    } catch (error) {
      if (error instanceof ModelInferenceError) {
        throw new AIServiceError(
          error.getUserMessage(),
          error.statusCode || 500
        );
      }
      throw error;
    }

    // 步骤5: 保存生成的图像
    console.log('Step 5: Saving generated image...');
    let saveStartTime = Date.now();
    
    const imageUrl = await saveGeneratedImage(generatedImage);
    metrics.saveTime = Date.now() - saveStartTime;
    console.log(`Image saved in ${metrics.saveTime}ms`);

    // 计算总时间
    metrics.totalTime = Date.now() - startTime;
    const generationTime = metrics.totalTime / 1000;

    console.log('=== Generation completed ===');
    console.log('Metrics:', {
      sketchRender: `${metrics.sketchRenderTime}ms`,
      preprocess: `${metrics.preprocessTime}ms`,
      promptBuild: `${metrics.promptBuildTime}ms`,
      generation: `${metrics.generationTime}ms`,
      save: `${metrics.saveTime}ms`,
      total: `${metrics.totalTime}ms`
    });
    console.log('Result URL:', imageUrl);

    // 返回成功响应
    res.json({
      success: true,
      imageUrl: imageUrl,
      generationTime: parseFloat(generationTime.toFixed(2))
    } as GenerationResponse);

  } catch (error: any) {
    metrics.totalTime = Date.now() - startTime;
    const generationTime = metrics.totalTime / 1000;
    
    console.error('=== Generation failed ===');
    console.error('Error:', error.message);
    console.error('Time elapsed:', generationTime.toFixed(2), 's');
    console.error('Metrics at failure:', metrics);

    // 重新抛出错误，让错误处理中间件处理
    throw error;
  }
}));

/**
 * GET /api/v2/generate/status
 * 检查 Qwen 生成服务状态
 */
router.get('/status', (_req, res) => {
  try {
    validateApiKey();
    
    res.json({
      available: true,
      service: 'qwen-image',
      message: 'Qwen-Image generation service is ready'
    });
  } catch (error) {
    res.json({
      available: false,
      service: 'qwen-image',
      error: 'DASHSCOPE_API_KEY not configured',
      message: 'Qwen-Image generation service is not properly configured'
    });
  }
});

export default router;
