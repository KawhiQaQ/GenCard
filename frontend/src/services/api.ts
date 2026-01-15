import { 
  GenerationRequest, 
  GenerationResponse, 
  UploadResponse, 
  CardGenerationRequest, 
  TextBoxConfig,
  LayoutMode,
  LayoutVariant,
  TextureType,
  BlurIntensity,
  GlowIntensity,
  ScalePreset
} from '../types/canvas';
import { 
  FramePresetId, 
  ApplyFrameRequest, 
  ApplyFrameResponse 
} from '../types/frame';

// 原画生成请求接口
export interface ArtworkGenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
}

// 原画生成响应接口
export interface ArtworkGenerateResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationTime?: number;
}

// 卡牌背景生成请求接口（发送到后端）
export interface CardBackgroundRequest {
  artworkUrl: string;
  textBoxes: TextBoxConfig[];
  backgroundPrompt: string;
  canvasWidth: number;
  canvasHeight: number;
  // 新增参数 - 用户选择的布局和视觉效果
  layoutMode?: LayoutMode;
  layoutVariant?: LayoutVariant;
  textBoxColorId?: string;
  textureType?: TextureType;
  blurIntensity?: BlurIntensity;
  glowIntensity?: GlowIntensity;
  scalePreset?: ScalePreset;
}

// 卡牌背景生成响应接口
export interface CardBackgroundResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  generationTime?: number;
}

const API_BASE_URL = '/api';
const REQUEST_TIMEOUT = 60000; // 60 seconds

// 文件验证常量
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * 验证上传文件
 */
export function validateUploadFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: '不支持的文件格式。仅支持 JPG、PNG 和 WEBP 格式。'
      };
    }
  }

  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小超过限制。最大允许 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB，当前文件 ${(file.size / 1024 / 1024).toFixed(2)}MB。`
    };
  }

  return { valid: true };
}

/**
 * 创建带超时的 fetch 请求
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

/**
 * 解析错误响应
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.message || response.statusText;
  } catch {
    return response.statusText || '未知错误';
  }
}

/**
 * 上传图片
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  // 前端验证
  const validation = validateUploadFile(file);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    
    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络后重试',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败，请重试',
    };
  }
}

/**
 * 生成卡牌
 */
export async function generateCard(request: GenerationRequest): Promise<GenerationResponse> {
  try {
    // Use unified API that auto-routes based on GENERATION_MODE
    const response = await fetchWithTimeout(`${API_BASE_URL}/generate/unified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Generation error:', error);
    
    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络后重试',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成失败，请重试',
    };
  }
}


/**
 * 生成原画（第一阶段）
 * 调用后端 /api/artwork/generate 接口生成聚焦人物的原画
 */
export async function generateArtwork(request: ArtworkGenerateRequest): Promise<ArtworkGenerateResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/artwork/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Artwork generation error:', error);
    
    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络后重试',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '原画生成失败，请重试',
    };
  }
}


/**
 * 生成卡牌背景（第二阶段）
 * 调用后端 /api/card/generate-background 接口
 * 使用 Qwen Inpainting 模型生成背景，保护原画框和文本框区域
 */
export async function generateCardBackground(request: CardGenerationRequest): Promise<CardBackgroundResponse> {
  // 导入布局常量以获取画布尺寸（使用 layoutVariant 获取正确配置）
  const { getLayoutConfigByVariant } = await import('../constants/cardLayout');
  const layout = getLayoutConfigByVariant(request.layoutVariant);
  
  // 构建后端请求 - 传递所有用户选择的参数
  const backendRequest: CardBackgroundRequest = {
    artworkUrl: request.artworkUrl,
    textBoxes: request.textBoxes,
    backgroundPrompt: request.backgroundPrompt,
    canvasWidth: layout.canvas.width,
    canvasHeight: layout.canvas.height,
    // 传递布局参数
    layoutMode: request.layoutMode,
    layoutVariant: request.layoutVariant,
    // 传递视觉效果参数
    textBoxColorId: request.textBoxColorId,
    textureType: request.textureType,
    blurIntensity: request.blurIntensity,
    glowIntensity: request.glowIntensity,
    scalePreset: request.scalePreset
  };

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/card/generate-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendRequest),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Card background generation error:', error);
    
    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络后重试',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '背景生成失败，请重试',
    };
  }
}


/**
 * 应用装饰边框到卡牌图片
 * 
 * 调用后端 /api/card/apply-frame 接口，将选定的边框风格应用到卡牌图片上。
 * 
 * Requirements: 6.1
 * 
 * @param cardImageUrl - 卡牌图片 URL
 * @param framePresetId - 边框预设ID
 * @param layoutVariant - 布局变体
 * @param options - 可选的自定义参数
 * @returns 应用边框后的结果
 */
export async function applyFrame(
  cardImageUrl: string,
  framePresetId: FramePresetId,
  layoutVariant: LayoutVariant,
  options?: {
    insetOffset?: number;
    borderThickness?: number;
  }
): Promise<ApplyFrameResponse> {
  // 如果选择"无边框"，直接返回原图
  if (framePresetId === 'none') {
    return {
      success: true,
      imageUrl: cardImageUrl,
    };
  }

  const request: ApplyFrameRequest = {
    cardImageUrl,
    framePresetId,
    layoutVariant,
    ...options,
  };

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/card/apply-frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Apply frame error:', error);
    
    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: '网络连接失败，请检查网络后重试',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '应用边框失败，请重试',
    };
  }
}
