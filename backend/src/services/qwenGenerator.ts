import { GenerationConfig, TextToImageConfig, InpaintConfig } from '../types/index.js';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import OSS from 'ali-oss';

/**
 * QwenGeneratorService
 *
 * 负责调用 Qwen-Image API 生成图像
 * 使用 ControlNet 确保生成的图像遵循布局草图
 *
 * 使用阿里云 OSS 存储草图图片（公共读），确保 DashScope 可访问
 */

// DashScope API 配置
// 涂鸦作画模型使用 image2image/image-synthesis 接口
const DASHSCOPE_API_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis';
const DASHSCOPE_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

/**
 * 支持的文生图模型版本
 */
export const TEXT2IMAGE_MODELS = {
  /** 旧版模型 - wanx-v1 */
  WANX_V1: 'wanx-v1',
  /** 新版模型 - wan2.5-t2i-preview (推荐) */
  WAN25_T2I: 'wan2.5-t2i-preview',
} as const;

export type Text2ImageModel = typeof TEXT2IMAGE_MODELS[keyof typeof TEXT2IMAGE_MODELS];

/**
 * 阿里云 OSS 客户端（用于上传草图到公共读存储桶）
 */
class AliyunOSSClient {
  private client: OSS | null = null;
  private bucket: string;
  private region: string;
  private endpoint: string;

  constructor() {
    this.bucket = process.env.ALIYUN_OSS_BUCKET || '';
    this.region = process.env.ALIYUN_OSS_REGION || 'oss-cn-shanghai';
    // 支持自定义 endpoint，格式如: https://oss-cn-hangzhou.aliyuncs.com
    this.endpoint = process.env.ALIYUN_OSS_ENDPOINT || `https://${this.region}.aliyuncs.com`;
  }

  /**
   * 获取或创建 OSS 客户端
   */
  private getClient(): OSS {
    if (!this.client) {
      const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
      const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

      if (!accessKeyId || !accessKeySecret || !this.bucket) {
        throw new Error(
          '阿里云 OSS 配置不完整。请设置环境变量: ALIYUN_OSS_ACCESS_KEY_ID, ALIYUN_OSS_ACCESS_KEY_SECRET, ALIYUN_OSS_BUCKET'
        );
      }

      console.log('初始化 OSS 客户端:');
      console.log('  Endpoint:', this.endpoint);
      console.log('  Bucket:', this.bucket);

      this.client = new OSS({
        region: this.region,
        endpoint: this.endpoint,
        accessKeyId,
        accessKeySecret,
        bucket: this.bucket,
      });
    }
    return this.client;
  }

  /**
   * 上传图片到 OSS（公共读）
   *
   * @param imageBuffer - 图片 Buffer
   * @param prefix - 文件前缀目录
   * @returns 公网 HTTPS URL
   */
  async uploadImage(imageBuffer: Buffer, prefix: string = 'sketches'): Promise<string> {
    const client = this.getClient();
    const fileName = `${prefix}/${uuidv4()}.png`;

    console.log('正在上传图片到阿里云 OSS...');
    console.log('  Bucket:', this.bucket);
    console.log('  文件名:', fileName);

    try {
      await client.put(fileName, imageBuffer, {
        headers: {
          'Content-Type': 'image/png',
          // 设置为公共读
          'x-oss-object-acl': 'public-read',
        },
      });

      // 构建公网 HTTPS URL
      // 格式: https://{bucket}.{region}.aliyuncs.com/{fileName}
      const publicUrl = `https://${this.bucket}.${this.region}.aliyuncs.com/${fileName}`;

      console.log('图片上传成功，公网 URL:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('OSS 上传失败:', error.message);
      throw new Error(`阿里云 OSS 上传失败: ${error.message}`);
    }
  }
}

// 全局 OSS 客户端实例
let ossClientInstance: AliyunOSSClient | null = null;

function getOSSClient(): AliyunOSSClient {
  if (!ossClientInstance) {
    ossClientInstance = new AliyunOSSClient();
  }
  return ossClientInstance;
}

/**
 * DashScope API 客户端
 */
class DashScopeClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 调用图像生成 API
   */
  async generateImage(params: {
    model: string;
    prompt: string;
    controlImageUrl?: string;
    width: number;
    height: number;
    steps?: number;
    guidanceScale?: number;
    controlnetScale?: number;
    seed?: number;
    negativePrompt?: string;
  }): Promise<{ taskId: string; imageUrl?: string }> {
    // 强制使用涂鸦作画模型
    const targetModel = 'wanx-sketch-to-image-v1';

    // wanx-sketch-to-image-v1 支持的尺寸: 1024*1024, 720*1280, 1280*720
    // 根据输入尺寸选择最接近的支持尺寸
    let size = '1024*1024'; // 默认正方形
    const aspectRatio = params.width / params.height;

    if (aspectRatio > 1.2) {
      size = '1280*720'; // 横向
    } else if (aspectRatio < 0.8) {
      size = '720*1280'; // 纵向
    }

    console.log(`尺寸调整: 原始 ${params.width}*${params.height} -> API ${size}`);

    const requestBody = {
      model: targetModel,
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
      } as any,
      parameters: {
        size: size,
        n: 1,
        seed: params.seed
      } as any
    };

    // 如果提供了 OSS 上传后的公网 URL，添加涂鸦专有的控制参数
    if (params.controlImageUrl) {
      // 涂鸦作画模型要求使用 sketch_image_url
      // 参考文档: https://help.aliyun.com/zh/model-studio/developer-reference/tongyi-wanxiang-sketch-to-image
      requestBody.input.sketch_image_url = params.controlImageUrl;
      // 涂鸦强度参数名为 sketch_weight，取值 0-1，默认 0.5
      requestBody.parameters.sketch_weight = Math.min(params.controlnetScale || 0.5, 1.0);
    }

    console.log('生成请求体:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable' // 必须开启异步模式以获取 taskId
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ModelInferenceError(
        `DashScope API error: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json() as any;

    // 涂鸦作画是异步任务，必须返回 task_id 进行轮询
    if (data.output?.task_id) {
      return { taskId: data.output.task_id };
    }

    // 兼容同步返回（虽然该模型较少见同步返回）
    if (data.output?.results?.[0]?.url) {
      return { taskId: '', imageUrl: data.output.results[0].url };
    }

    throw new Error('Unexpected API response format: ' + JSON.stringify(data));
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string): Promise<{
    status: string;
    imageUrl?: string;
    error?: string;
  }> {
    const response = await fetch(`${DASHSCOPE_TASK_URL}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new ModelInferenceError(
        `Failed to get task status: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json() as any;

    return {
      status: data.output?.task_status || 'UNKNOWN',
      imageUrl: data.output?.results?.[0]?.url,
      error: data.output?.message
    };
  }

  /**
   * 等待任务完成
   */
  async waitForTask(taskId: string, maxWaitTime: number = 120000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 秒轮询一次

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'SUCCEEDED' && status.imageUrl) {
        return status.imageUrl;
      }

      if (status.status === 'FAILED') {
        throw new Error(`Task failed: ${status.error || 'Unknown error'}`);
      }

      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Task timeout: Image generation took too long');
  }

  /**
   * 下载图像
   * 
   * @param imageUrl - 图像 URL
   * @returns 图像 Buffer
   */
  async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

/**
 * 模型推理错误
 */
export class ModelInferenceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: string
  ) {
    super(message);
    this.name = 'ModelInferenceError';
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    if (this.statusCode === 401) {
      return 'API 密钥无效，请检查配置';
    } else if (this.statusCode === 429) {
      return 'API 调用频率超限，请稍后重试';
    } else if (this.statusCode === 503) {
      return 'AI 服务暂时不可用，请稍后重试';
    } else if (this.statusCode === 400) {
      return '请求参数错误：' + (this.details || this.message);
    } else if (this.message.includes('timeout')) {
      return '请求超时，图像生成时间过长';
    } else {
      return '图像生成失败：' + this.message;
    }
  }

  /**
   * 获取错误代码
   */
  getErrorCode(): string {
    if (this.statusCode === 401) {
      return 'INVALID_API_KEY';
    } else if (this.statusCode === 429) {
      return 'RATE_LIMIT_EXCEEDED';
    } else if (this.statusCode === 503) {
      return 'SERVICE_UNAVAILABLE';
    } else if (this.statusCode === 400) {
      return 'INVALID_REQUEST';
    } else if (this.message.includes('timeout')) {
      return 'TIMEOUT';
    } else {
      return 'GENERATION_FAILED';
    }
  }
}

// 全局客户端实例
let clientInstance: DashScopeClient | null = null;

/**
 * 获取或创建 DashScope 客户端
 */
function getClient(): DashScopeClient {
  if (!clientInstance) {
    validateApiKey();
    clientInstance = new DashScopeClient(process.env.DASHSCOPE_API_KEY!);
  }
  return clientInstance;
}

// /**
//  * 生成图像
//  * 

/**
 * 生成图像
 * * @param sketchImage - 草图图像 Buffer
 * @param prompt - 完整的提示词
 * @param config - 生成配置
 * @returns 生成的图像 Buffer
 * @throws ModelInferenceError 当生成失败时
 */
export async function generate(
  sketchImage: Buffer,
  prompt: string,
  config: GenerationConfig
): Promise<Buffer> {
  // 1. 验证基础配置（尺寸、步数等）
  validateConfig(config);

  const client = getClient();

  try {
    // 步骤 1: 上传草图到阿里云 OSS（公共读）
    console.log('Step 1: Uploading sketch image to Aliyun OSS (public-read)...');
    const ossClient = getOSSClient();
    const sketchOssUrl = await ossClient.uploadImage(sketchImage, 'cardforge-sketches');
    console.log('Sketch uploaded successfully. Public URL:', sketchOssUrl);

    // 步骤 2: 调用通义万相-涂鸦作画 API
    console.log('Step 2: Calling Wanx Sketch-to-Image API...');

    /**
     * 注意：涂鸦作画模型必须是 wanx-sketch-to-image-v1。
     * 环境变量 QWEN_MODEL 若为 wanx-v1 会导致参数错误，
     * 因此这里建议直接指定或在环境变量中修改。
     */
    const model = process.env.QWEN_MODEL === 'wanx-v1'
      ? 'wanx-sketch-to-image-v1'
      : (process.env.QWEN_MODEL || 'wanx-sketch-to-image-v1');

    const result = await client.generateImage({
      model,
      prompt,
      controlImageUrl: sketchOssUrl,
      width: config.width,
      height: config.height,
      controlnetScale: config.controlnetScale, // 对应参数中的 sketch_factor
      seed: config.seed,
      negativePrompt: config.negativePrompt
    });

    // 步骤 3: 处理异步任务轮询
    let imageUrl: string;
    if (result.taskId) {
      console.log('Step 3: Waiting for AI task completion. Task ID:', result.taskId);
      const maxWaitTime = parseInt(process.env.MAX_GENERATION_TIME || '120000');

      try {
        imageUrl = await client.waitForTask(result.taskId, maxWaitTime);
      } catch (error) {
        if ((error as Error).message.includes('timeout')) {
          throw new ModelInferenceError('图像生成超时，请稍后在历史记录中查看', undefined, 'timeout');
        }
        throw error; // 抛出由 waitForTask 捕获的 FAILED 状态错误
      }
    } else if (result.imageUrl) {
      imageUrl = result.imageUrl;
    } else {
      throw new ModelInferenceError('API 未返回任务 ID 或图像 URL');
    }

    console.log('Task Succeeded. Final Image URL:', imageUrl);

    // 步骤 4: 下载生成的图像到本地 Buffer
    console.log('Step 4: Downloading generated image...');
    try {
      const imageBuffer = await client.downloadImage(imageUrl);
      console.log('=== Generation Completed Successfully ===');
      return imageBuffer;
    } catch (error) {
      throw new ModelInferenceError(
        '图像已生成但下载失败: ' + (error as Error).message
      );
    }

  } catch (error) {
    // 统一记录并处理所有生成阶段的错误
    console.error('[Generation Flow Error]:', error);

    if (error instanceof ModelInferenceError) {
      throw error;
    }

    throw new ModelInferenceError(
      '图像生成过程中发生非预期错误: ' + (error as Error).message
    );
  }
}

/**
 * 验证生成配置
 * 
 * @param config - 生成配置
 * @throws Error 如果配置无效
 */
export function validateConfig(config: GenerationConfig): void {
  if (config.width < 100 || config.width > 4096) {
    throw new Error(`Invalid width: ${config.width}. Must be between 100 and 4096.`);
  }

  if (config.height < 100 || config.height > 4096) {
    throw new Error(`Invalid height: ${config.height}. Must be between 100 and 4096.`);
  }

  if (config.steps < 1 || config.steps > 100) {
    throw new Error(`Invalid steps: ${config.steps}. Must be between 1 and 100.`);
  }

  if (config.guidanceScale < 0 || config.guidanceScale > 20) {
    throw new Error(`Invalid guidanceScale: ${config.guidanceScale}. Must be between 0 and 20.`);
  }

  if (config.controlnetScale < 0 || config.controlnetScale > 2) {
    throw new Error(`Invalid controlnetScale: ${config.controlnetScale}. Must be between 0 and 2.`);
  }
}

/**
 * 验证 API 密钥是否配置
 * 
 * @throws Error 如果 API 密钥未配置
 */
export function validateApiKey(): void {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error(
      'DASHSCOPE_API_KEY is not configured. Please set it in your environment variables.'
    );
  }
}

/**
 * 启动时配置检查
 * 
 * 验证所有必需的配置项是否正确设置
 * 
 * @returns 配置检查结果
 */
export function checkConfiguration(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查 API 密钥
  if (!process.env.DASHSCOPE_API_KEY) {
    errors.push('DASHSCOPE_API_KEY is not configured');
  }

  // 检查草图目录配置
  const sketchDir = process.env.SKETCH_DIR || './sketches';
  if (!sketchDir) {
    warnings.push('SKETCH_DIR not configured, using default: ./sketches');
  }

  // 检查生成参数配置
  const steps = parseInt(process.env.GENERATION_STEPS || '30');
  if (isNaN(steps) || steps < 1 || steps > 100) {
    warnings.push(`Invalid GENERATION_STEPS: ${process.env.GENERATION_STEPS}, using default: 30`);
  }

  const guidanceScale = parseFloat(process.env.GUIDANCE_SCALE || '7.5');
  if (isNaN(guidanceScale) || guidanceScale < 0 || guidanceScale > 20) {
    warnings.push(`Invalid GUIDANCE_SCALE: ${process.env.GUIDANCE_SCALE}, using default: 7.5`);
  }

  const controlnetScale = parseFloat(process.env.CONTROLNET_SCALE || '1.0');
  if (isNaN(controlnetScale) || controlnetScale < 0 || controlnetScale > 2) {
    warnings.push(`Invalid CONTROLNET_SCALE: ${process.env.CONTROLNET_SCALE}, using default: 1.0`);
  }

  const maxGenerationTime = parseInt(process.env.MAX_GENERATION_TIME || '120000');
  if (isNaN(maxGenerationTime) || maxGenerationTime < 10000) {
    warnings.push(`Invalid MAX_GENERATION_TIME: ${process.env.MAX_GENERATION_TIME}, using default: 120000`);
  }

  // 检查模型配置
  const model = process.env.QWEN_MODEL || 'wanx-v1';
  if (!model) {
    warnings.push('QWEN_MODEL not configured, using default: wanx-v1');
  }

  // 检查文生图模型配置
  const text2imageModel = process.env.TEXT2IMAGE_MODEL || TEXT2IMAGE_MODELS.WANX_V1;
  if (text2imageModel !== TEXT2IMAGE_MODELS.WANX_V1 && text2imageModel !== TEXT2IMAGE_MODELS.WAN25_T2I) {
    warnings.push(`Unknown TEXT2IMAGE_MODEL: ${text2imageModel}, using default: wanx-v1`);
  } else {
    console.log(`文生图模型配置: ${text2imageModel}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 获取默认生成配置
 * 
 * 从环境变量读取默认配置值
 */
export function getDefaultGenerationConfig(
  width: number,
  height: number
): GenerationConfig {
  return {
    width,
    height,
    steps: parseInt(process.env.GENERATION_STEPS || '30'),
    guidanceScale: parseFloat(process.env.GUIDANCE_SCALE || '7.5'),
    controlnetScale: parseFloat(process.env.CONTROLNET_SCALE || '1.0'),
    negativePrompt: process.env.DEFAULT_NEGATIVE_PROMPT || 'low quality, blurry, distorted'
  };
}

// ============ 文生图 API 配置 ============
const DASHSCOPE_TEXT2IMAGE_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';

/**
 * 获取当前配置的文生图模型
 * 
 * 通过环境变量 TEXT2IMAGE_MODEL 配置，默认使用 wanx-v1
 * 可选值: 'wanx-v1' | 'wan2.5-t2i-preview'
 */
function getText2ImageModel(): Text2ImageModel {
  const envModel = process.env.TEXT2IMAGE_MODEL;
  console.log('[getText2ImageModel] 环境变量 TEXT2IMAGE_MODEL:', envModel);
  
  const model = envModel || TEXT2IMAGE_MODELS.WANX_V1;
  console.log('[getText2ImageModel] 使用模型:', model);
  
  if (model === TEXT2IMAGE_MODELS.WAN25_T2I || model === TEXT2IMAGE_MODELS.WANX_V1) {
    return model;
  }
  console.warn(`未知的文生图模型: ${model}，使用默认模型 wanx-v1`);
  return TEXT2IMAGE_MODELS.WANX_V1;
}

/**
 * 根据模型版本计算支持的尺寸
 * 
 * wanx-v1 支持: 1024*1024, 720*1280, 1280*720
 * wan2.5-t2i-preview 支持: 1280*1280 ~ 1440*1440，宽高比 1:4 ~ 4:1
 */
function calculateSizeForModel(
  width: number,
  height: number,
  model: Text2ImageModel
): string {
  const aspectRatio = width / height;

  if (model === TEXT2IMAGE_MODELS.WAN25_T2I) {
    // wan2.5-t2i-preview 支持更高分辨率和更灵活的宽高比
    // 推荐分辨率: 1:1=1280*1280, 3:4=1104*1472, 4:3=1472*1104, 9:16=960*1696, 16:9=1696*960
    if (aspectRatio > 1.5) {
      return '1696*960'; // 16:9 横向
    } else if (aspectRatio > 1.2) {
      return '1472*1104'; // 4:3 横向
    } else if (aspectRatio < 0.67) {
      return '960*1696'; // 9:16 纵向
    } else if (aspectRatio < 0.8) {
      return '1104*1472'; // 3:4 纵向
    } else {
      return '1280*1280'; // 1:1 正方形
    }
  } else {
    // wanx-v1 支持的尺寸: 1024*1024, 720*1280, 1280*720
    if (aspectRatio > 1.2) {
      return '1280*720'; // 横向
    } else if (aspectRatio < 0.8) {
      return '720*1280'; // 纵向
    } else {
      return '1024*1024'; // 正方形
    }
  }
}

/**
 * 文生图生成原画
 * 
 * 调用 Qwen 文生图 API 生成聚焦人物的原画
 * 支持 wanx-v1 和 wan2.5-t2i-preview 两种模型
 * 
 * @param prompt - 人物描述提示词
 * @param config - 生成配置（可选 skipPromptEnhancement 跳过提示词增强）
 * @returns 生成的图像 Buffer
 * @throws ModelInferenceError 当生成失败时
 */
export async function generateFromText(
  prompt: string,
  config: TextToImageConfig
): Promise<Buffer> {
  validateApiKey();
  const client = getClient();

  // 获取配置的模型
  const model = getText2ImageModel();
  
  // 根据模型版本计算支持的尺寸
  const size = calculateSizeForModel(config.width, config.height, model);

  console.log('=== 开始文生图生成 ===');
  console.log('使用模型:', model);
  console.log('提示词:', prompt);
  console.log(`尺寸调整: 原始 ${config.width}*${config.height} -> API ${size}`);

  // 根据配置决定是否增强提示词
  // skipPromptEnhancement=true 时直接使用原始提示词（用于背景生成）
  const finalPrompt = config.skipPromptEnhancement ? prompt : buildArtworkPrompt(prompt);
  console.log('最终提示词:', finalPrompt);

  // 构建请求体 - 根据模型版本使用不同参数
  const requestBody = buildText2ImageRequestBody(model, finalPrompt, size, config);

  console.log('=== 请求体详情 ===');
  console.log('请求体中的模型:', requestBody.model);
  console.log('完整请求体:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(DASHSCOPE_TEXT2IMAGE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ModelInferenceError(
        `DashScope 文生图 API 错误: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json() as any;

    // 处理异步任务
    let imageUrl: string;
    if (data.output?.task_id) {
      console.log('任务已提交，Task ID:', data.output.task_id);
      const maxWaitTime = parseInt(process.env.MAX_GENERATION_TIME || '120000');
      imageUrl = await client.waitForTask(data.output.task_id, maxWaitTime);
    } else if (data.output?.results?.[0]?.url) {
      imageUrl = data.output.results[0].url;
    } else {
      throw new ModelInferenceError('API 未返回任务 ID 或图像 URL');
    }

    console.log('生成成功，图像 URL:', imageUrl);

    // 下载图像
    const imageBuffer = await client.downloadImage(imageUrl);
    console.log('=== 文生图原画生成完成 ===');
    return imageBuffer;

  } catch (error) {
    console.error('[文生图生成错误]:', error);

    if (error instanceof ModelInferenceError) {
      throw error;
    }

    throw new ModelInferenceError(
      '原画生成失败: ' + (error as Error).message
    );
  }
}

/**
 * 构建文生图请求体
 * 
 * 根据模型版本构建不同的请求参数
 * 新模型特有参数使用不影响卡牌的默认值
 */
function buildText2ImageRequestBody(
  model: Text2ImageModel,
  prompt: string,
  size: string,
  config: TextToImageConfig
): any {
  const defaultNegativePrompt = 'background, scenery, landscape, environment, low quality, blurry, distorted, deformed, ugly, bad anatomy';

  if (model === TEXT2IMAGE_MODELS.WAN25_T2I) {
    // wan2.5-t2i-preview 模型参数
    return {
      model: model,
      input: {
        prompt: prompt,
        negative_prompt: config.negativePrompt || defaultNegativePrompt
      },
      parameters: {
        size: size,
        n: 1,
        seed: config.seed,
        // 新模型特有参数 - 使用不影响卡牌的默认值
        prompt_extend: false,  // 关闭提示词扩展，保持原始提示词控制
        watermark: false       // 关闭水印，不影响卡牌效果
      }
    };
  } else {
    // wanx-v1 模型参数（保持原有逻辑）
    return {
      model: model,
      input: {
        prompt: prompt,
        negative_prompt: config.negativePrompt || defaultNegativePrompt
      },
      parameters: {
        size: size,
        n: 1,
        seed: config.seed
      }
    };
  }
}

/**
 * 构建原画生成提示词
 * 
 * 增强用户提示词，确保生成聚焦人物、最小化背景的原画
 * 
 * @param userPrompt - 用户输入的人物描述
 * @returns 增强后的提示词
 */
function buildArtworkPrompt(userPrompt: string): string {
  // 添加聚焦人物的前缀和后缀
  const prefix = 'portrait, character focus, centered composition, ';
  // const suffix = ', detailed face, high quality, masterpiece, best quality, solo, simple background, minimal background';
  const suffix = ', detailed, high quality, masterpiece, best quality, solo, simple background, minimal background';
  
  return `${prefix}${userPrompt}${suffix}`;
}

/**
 * 局部重绘（Inpainting）
 * 
 * 调用 Qwen Inpainting API 在保护 mask 区域的同时生成其他区域内容
 * 
 * @param baseImage - 基础图像 Buffer
 * @param maskImage - Mask 图像 Buffer（白色=保护区域，黑色=重绘区域）
 * @param prompt - 背景风格提示词
 * @param config - 重绘配置
 * @returns 生成的图像 Buffer
 * @throws ModelInferenceError 当生成失败时
 */
export async function inpaint(
  baseImage: Buffer,
  maskImage: Buffer,
  prompt: string,
  config: InpaintConfig
): Promise<Buffer> {
  validateApiKey();
  const client = getClient();
  const ossClient = getOSSClient();

  console.log('=== 开始局部重绘 ===');
  console.log('提示词:', prompt);

  try {
    // 上传基础图像和 Mask 到 OSS
    console.log('Step 1: 上传图像到 OSS...');
    const [baseImageUrl, maskImageUrl] = await Promise.all([
      ossClient.uploadImage(baseImage, 'cardforge-inpaint-base'),
      ossClient.uploadImage(maskImage, 'cardforge-inpaint-mask')
    ]);
    console.log('基础图像 URL:', baseImageUrl);
    console.log('Mask 图像 URL:', maskImageUrl);

    // 构建 Inpainting 请求
    // 使用 wanx2.1-imageedit 模型的 description_edit_with_mask 功能
    // 参考文档: https://help.aliyun.com/zh/model-studio/developer-reference/tongyi-wanxiang-api-for-image-editing
    console.log('Step 2: 调用 Inpainting API...');
    const requestBody = {
      model: 'wanx2.1-imageedit',
      input: {
        function: 'description_edit_with_mask',
        prompt: prompt,
        base_image_url: baseImageUrl,
        mask_image_url: maskImageUrl
      },
      parameters: {
        n: 1
      }
    };

    console.log('请求体:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ModelInferenceError(
        `DashScope Inpainting API 错误: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data = await response.json() as any;

    // 处理异步任务
    let imageUrl: string;
    if (data.output?.task_id) {
      console.log('Step 3: 等待任务完成，Task ID:', data.output.task_id);
      const maxWaitTime = parseInt(process.env.MAX_GENERATION_TIME || '120000');
      imageUrl = await client.waitForTask(data.output.task_id, maxWaitTime);
    } else if (data.output?.results?.[0]?.url) {
      imageUrl = data.output.results[0].url;
    } else {
      throw new ModelInferenceError('API 未返回任务 ID 或图像 URL');
    }

    console.log('重绘成功，图像 URL:', imageUrl);

    // 下载图像
    console.log('Step 4: 下载生成的图像...');
    const imageBuffer = await client.downloadImage(imageUrl);
    console.log('=== 局部重绘完成 ===');
    return imageBuffer;

  } catch (error) {
    console.error('[局部重绘错误]:', error);

    if (error instanceof ModelInferenceError) {
      throw error;
    }

    throw new ModelInferenceError(
      '背景生成失败: ' + (error as Error).message
    );
  }
}
