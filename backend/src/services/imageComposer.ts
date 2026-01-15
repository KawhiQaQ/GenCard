import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ImageFrameElement } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 旧格式的生成请求（用于向后兼容）
 */
interface LegacyGenerationRequest {
  layout: {
    canvas: {
      width: number;
      height: number;
    };
    elements: any[];
  };
  uploadedImages?: Array<{
    frameId: string;
    imageUrl: string;
  }>;
}

/**
 * 自定义图像处理错误类
 */
class ImageCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageCompositionError';
  }
}

/**
 * 合成图像
 * 将AI生成的基础图像与上传的照片合成
 */
export async function compositeImages(
  baseImageBuffer: Buffer,
  request: LegacyGenerationRequest
): Promise<string> {
  try {
    const { layout, uploadedImages } = request;
    
    // 验证基础图像
    if (!baseImageBuffer || baseImageBuffer.length === 0) {
      throw new ImageCompositionError('基础图像数据为空');
    }
    
    // 获取需要直接放置的上传图片
    const imagesToComposite: Array<{
      input: Buffer;
      top: number;
      left: number;
    }> = [];
    
    // 构建上传图片映射
    const uploadedImagesMap = new Map<string, string>();
    if (uploadedImages) {
      for (const img of uploadedImages) {
        uploadedImagesMap.set(img.frameId, img.imageUrl);
      }
    }
    
    for (const element of layout.elements) {
      if (element.type === 'imageframe') {
        const frame = element as ImageFrameElement;
        
        // 检查是否有上传的图片
        if (frame.uploadedImage?.id && uploadedImagesMap.has(frame.id)) {
          const imageUrl = uploadedImagesMap.get(frame.id)!;
          
          // 从 URL 中提取文件名
          const filename = imageUrl.split('/').pop() || '';
          const uploadedImagePath = path.join(
            __dirname,
            '..',
            '..',
            'uploads',
            filename
          );
          
          try {
            // 检查文件是否存在
            await fs.access(uploadedImagePath);
            
            // 验证图片尺寸
            if (frame.width <= 0 || frame.height <= 0) {
              console.warn(`Invalid frame dimensions for ${frame.id}: ${frame.width}x${frame.height}`);
              continue;
            }
            
            // 调整图片大小以适应原画框
            const resizedImage = await sharp(uploadedImagePath)
              .resize(Math.round(frame.width), Math.round(frame.height), {
                fit: 'cover',
                position: 'center'
              })
              .toBuffer();
            
            imagesToComposite.push({
              input: resizedImage,
              top: Math.round(frame.y),
              left: Math.round(frame.x)
            });
            
            console.log(`Added uploaded image for frame ${frame.id} at (${frame.x}, ${frame.y})`);
            
          } catch (error: any) {
            console.warn(`Failed to load uploaded image for frame ${frame.id}:`, error.message);
            // 继续处理其他图片，不中断整个流程
          }
        }
      }
    }
    
    // 如果有需要合成的图片，进行合成
    let finalImage = sharp(baseImageBuffer);
    
    if (imagesToComposite.length > 0) {
      console.log(`Compositing ${imagesToComposite.length} uploaded image(s)...`);
      finalImage = finalImage.composite(imagesToComposite);
    }
    
    // 验证画布尺寸
    const { width, height } = layout.canvas;
    if (width <= 0 || height <= 0 || width > 4096 || height > 4096) {
      throw new ImageCompositionError(`无效的画布尺寸: ${width}x${height}`);
    }
    
    // 调整到目标画布尺寸（如果需要）
    finalImage = finalImage.resize(width, height, {
      fit: 'fill'
    });
    
    // 保存最终结果
    const resultId = uuidv4();
    const resultFilename = `${resultId}.png`;
    const resultPath = path.join(__dirname, '..', '..', 'generated', resultFilename);
    
    await finalImage.png().toFile(resultPath);
    
    console.log(`Final image saved to: ${resultPath}`);
    
    // 返回可访问的URL路径
    return `/generated/${resultFilename}`;
    
  } catch (error: any) {
    console.error('Image composition error:', error);
    
    // 处理Sharp特定错误
    if (error.message.includes('Input file') || error.message.includes('unsupported')) {
      throw new ImageCompositionError('图像文件损坏或格式不支持');
    }
    
    if (error.message.includes('memory')) {
      throw new ImageCompositionError('图像处理内存不足');
    }
    
    if (error instanceof ImageCompositionError) {
      throw error;
    }
    
    throw new ImageCompositionError(`图像合成失败: ${error.message}`);
  }
}

/**
 * 检查是否有需要合成的上传图片
 */
export function hasImagesToComposite(request: LegacyGenerationRequest): boolean {
  const { layout, uploadedImages } = request;
  
  if (!uploadedImages || uploadedImages.length === 0) {
    return false;
  }
  
  // 构建上传图片映射
  const uploadedImagesMap = new Map<string, string>();
  for (const img of uploadedImages) {
    uploadedImagesMap.set(img.frameId, img.imageUrl);
  }
  
  for (const element of layout.elements) {
    if (element.type === 'imageframe') {
      const frame = element as ImageFrameElement;
      
      // 检查是否有上传的图片
      if (frame.uploadedImage?.id && uploadedImagesMap.has(frame.id)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 直接保存AI生成的图片（无需合成）
 */
export async function saveGeneratedImage(imageBuffer: Buffer): Promise<string> {
  try {
    // 验证图像数据
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new ImageCompositionError('图像数据为空');
    }
    
    const resultId = uuidv4();
    const resultFilename = `${resultId}.png`;
    const resultPath = path.join(__dirname, '..', '..', 'generated', resultFilename);
    
    await sharp(imageBuffer)
      .png()
      .toFile(resultPath);
    
    console.log(`Generated image saved to: ${resultPath}`);
    
    return `/generated/${resultFilename}`;
    
  } catch (error: any) {
    console.error('Failed to save generated image:', error);
    
    // 处理Sharp特定错误
    if (error.message.includes('Input file') || error.message.includes('unsupported')) {
      throw new ImageCompositionError('生成的图像数据无效');
    }
    
    if (error.code === 'ENOSPC') {
      throw new ImageCompositionError('磁盘空间不足');
    }
    
    throw new ImageCompositionError(`保存图像失败: ${error.message}`);
  }
}
