import OpenAI from 'openai';
import { LayoutDraft } from '../types/index.js';

// 初始化OpenAI客户端
let openaiClient: OpenAI | null = null;

/**
 * 自定义OpenAI错误类
 */
class OpenAIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIConfigError';
  }
}

class OpenAIAPIError extends Error {
  status?: number;
  
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenAIAPIError';
    this.status = status;
  }
}

/**
 * 获取或创建OpenAI客户端实例
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      throw new OpenAIConfigError('OpenAI API密钥未配置。请在.env文件中设置OPENAI_API_KEY。');
    }
    
    openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: 60000, // 60秒超时
    });
  }
  
  return openaiClient;
}

/**
 * 使用OpenAI DALL-E生成卡牌图像
 */
export async function generateCardWithAI(
  prompt: string,
  layout: LayoutDraft
): Promise<Buffer> {
  try {
    const client = getOpenAIClient();
    
    console.log('Calling OpenAI DALL-E API...');
    console.log('Prompt length:', prompt.length);
    
    // 确定图像尺寸（DALL-E 3支持的尺寸）
    const size = determineImageSize(layout.canvas.width, layout.canvas.height);
    
    // 调用DALL-E 3 API
    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: 'standard',
      response_format: 'url',
    });
    
    if (!response.data || response.data.length === 0) {
      throw new OpenAIAPIError('OpenAI API未返回图像数据');
    }
    
    const imageUrl = response.data[0]?.url;
    
    if (!imageUrl) {
      throw new OpenAIAPIError('OpenAI API未返回图像URL');
    }
    
    console.log('Image generated successfully, downloading...');
    
    // 下载生成的图片
    const imageBuffer = await downloadImage(imageUrl);
    
    console.log('Image downloaded, size:', imageBuffer.length, 'bytes');
    
    return imageBuffer;
    
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // 处理配置错误
    if (error instanceof OpenAIConfigError) {
      throw error;
    }
    
    // 处理不同类型的API错误
    if (error.status === 429) {
      throw new OpenAIAPIError('API调用频率超限，请稍后重试', 429);
    } else if (error.status === 401 || error.status === 403) {
      throw new OpenAIAPIError('OpenAI API密钥无效，请检查配置', 401);
    } else if (error.status === 500 || error.status === 503) {
      throw new OpenAIAPIError('OpenAI服务暂时不可用，请稍后重试', 503);
    } else if (error.status === 400) {
      throw new OpenAIAPIError(`请求参数错误: ${error.message}`, 400);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new OpenAIAPIError('请求超时，AI服务响应时间过长', 504);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new OpenAIAPIError('无法连接到OpenAI服务', 503);
    } else if (error.message) {
      throw new OpenAIAPIError(`AI生成失败: ${error.message}`, error.status);
    } else {
      throw new OpenAIAPIError('AI生成失败，未知错误', 500);
    }
  }
}

/**
 * 确定合适的图像尺寸
 * DALL-E 3支持: 1024x1024, 1024x1792, 1792x1024
 */
function determineImageSize(width: number, height: number): '1024x1024' | '1024x1792' | '1792x1024' {
  const aspectRatio = width / height;
  
  if (aspectRatio > 1.3) {
    // 横向卡牌
    return '1792x1024';
  } else if (aspectRatio < 0.77) {
    // 纵向卡牌
    return '1024x1792';
  } else {
    // 方形或接近方形
    return '1024x1024';
  }
}

/**
 * 从URL下载图片
 */
async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000) // 30秒超时
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
    
  } catch (error: any) {
    console.error('Image download error:', error);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      throw new Error('图片下载超时');
    }
    
    throw new Error(`图片下载失败: ${error.message}`);
  }
}

/**
 * 验证OpenAI API配置
 */
export function validateOpenAIConfig(): { valid: boolean; error?: string } {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      valid: false,
      error: 'OPENAI_API_KEY环境变量未设置'
    };
  }
  
  if (apiKey === 'your-openai-api-key-here') {
    return {
      valid: false,
      error: 'OPENAI_API_KEY仍为默认占位符值'
    };
  }
  
  return { valid: true };
}
