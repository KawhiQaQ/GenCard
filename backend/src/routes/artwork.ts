import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ArtworkGenerateRequest, ArtworkGenerateResponse } from '../types/index.js';
import { generateFromText, ModelInferenceError } from '../services/qwenGenerator.js';
import { ValidationError, AIServiceError, asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 原画默认尺寸（与原画框宽高比匹配 400:688 ≈ 9:16）
const DEFAULT_ARTWORK_WIDTH = 720;
const DEFAULT_ARTWORK_HEIGHT = 1280;

/**
 * 验证原画生成请求
 */
function validateArtworkRequest(request: any): { valid: boolean; error?: string } {
  if (!request.prompt || typeof request.prompt !== 'string') {
    return { valid: false, error: '缺少人物描述提示词' };
  }

  if (request.prompt.trim().length === 0) {
    return { valid: false, error: '提示词不能为空' };
  }

  if (request.prompt.length > 1000) {
    return { valid: false, error: `提示词长度超过限制：${request.prompt.length}（最大1000字符）` };
  }

  // 验证可选的尺寸参数
  if (request.width !== undefined) {
    if (typeof request.width !== 'number' || request.width < 256 || request.width > 2048) {
      return { valid: false, error: '宽度必须在256-2048像素之间' };
    }
  }

  if (request.height !== undefined) {
    if (typeof request.height !== 'number' || request.height < 256 || request.height > 2048) {
      return { valid: false, error: '高度必须在256-2048像素之间' };
    }
  }

  return { valid: true };
}

/**
 * POST /api/artwork/generate
 * 生成原画（文生图）
 * 
 * 调用 Qwen 文生图 API 生成聚焦人物的原画
 */
router.post('/generate', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  const request: ArtworkGenerateRequest = req.body;
  
  // 验证请求
  const validation = validateArtworkRequest(request);
  if (!validation.valid) {
    throw new ValidationError(validation.error!);
  }
  
  console.log('=== 开始原画生成 ===');
  console.log('提示词:', request.prompt);
  
  // 使用默认尺寸或用户指定尺寸
  const width = request.width || DEFAULT_ARTWORK_WIDTH;
  const height = request.height || DEFAULT_ARTWORK_HEIGHT;
  console.log('目标尺寸:', `${width}x${height}`);
  
  try {
    // 调用文生图服务
    const imageBuffer = await generateFromText(request.prompt, {
      width,
      height,
      negativePrompt: 'background, scenery, landscape, environment, low quality, blurry, distorted, deformed, ugly, bad anatomy, multiple people, crowd'
    });
    
    // 保存生成的图像
    const generatedDir = path.join(__dirname, '..', '..', 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    
    const fileName = `artwork_${uuidv4()}.png`;
    const filePath = path.join(generatedDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);
    
    const imageUrl = `/generated/${fileName}`;
    const generationTime = (Date.now() - startTime) / 1000;
    
    console.log('=== 原画生成完成 ===');
    console.log('生成时间:', generationTime.toFixed(2), 's');
    console.log('图像 URL:', imageUrl);
    
    const response: ArtworkGenerateResponse = {
      success: true,
      imageUrl,
      generationTime: parseFloat(generationTime.toFixed(2))
    };
    
    res.json(response);
    
  } catch (error: any) {
    const generationTime = (Date.now() - startTime) / 1000;
    console.error('=== 原画生成失败 ===');
    console.error('错误:', error.message);
    console.error('耗时:', generationTime.toFixed(2), 's');
    
    if (error instanceof ModelInferenceError) {
      throw new AIServiceError(error.getUserMessage(), error.statusCode || 500);
    }
    
    throw error;
  }
}));

/**
 * GET /api/artwork/status
 * 检查原画生成服务状态
 */
router.get('/status', (_req, res) => {
  const hasApiKey = !!process.env.DASHSCOPE_API_KEY;
  
  res.json({
    available: hasApiKey,
    message: hasApiKey 
      ? '原画生成服务已就绪' 
      : '原画生成服务未配置（缺少 DASHSCOPE_API_KEY）',
    defaultSize: {
      width: DEFAULT_ARTWORK_WIDTH,
      height: DEFAULT_ARTWORK_HEIGHT
    }
  });
});

export default router;
