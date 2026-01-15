import sharp from 'sharp';

/**
 * ControlNet 预处理器类型
 */
export type PreprocessorMethod = 'canny' | 'depth' | 'pose';

/**
 * 预处理配置选项
 */
export interface PreprocessorOptions {
  method: PreprocessorMethod;
  // Canny 边缘检测参数
  cannyLowThreshold?: number;
  cannyHighThreshold?: number;
  // 通用参数
  blurSigma?: number;
}

/**
 * 预处理错误类
 */
export class PreprocessorError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'PreprocessorError';
  }
}

/**
 * ControlNet 预处理服务
 * 用于处理布局草图，提取结构信息用于 ControlNet
 */
export class ControlNetPreprocessor {
  /**
   * 预处理图像
   * @param imageBuffer 输入图像 Buffer
   * @param options 预处理选项
   * @returns 预处理后的图像 Buffer
   */
  async preprocess(
    imageBuffer: Buffer,
    options: PreprocessorOptions
  ): Promise<Buffer> {
    try {
      // 验证输入
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new PreprocessorError('Invalid image buffer: empty or null');
      }

      // 验证预处理选项
      validatePreprocessorOptions(options);

      // 验证图像是否有效
      try {
        const metadata = await sharp(imageBuffer).metadata();
        
        // 检查图像尺寸
        if (!metadata.width || !metadata.height) {
          throw new PreprocessorError('Invalid image: missing dimensions');
        }

        // 检查图像格式
        if (!metadata.format) {
          throw new PreprocessorError('Invalid image: unknown format');
        }

        // 检查图像尺寸是否合理
        if (metadata.width < 10 || metadata.height < 10) {
          throw new PreprocessorError('Invalid image: dimensions too small (minimum 10x10)');
        }

        if (metadata.width > 8192 || metadata.height > 8192) {
          throw new PreprocessorError('Invalid image: dimensions too large (maximum 8192x8192)');
        }

        console.log(`[ControlNet] Preprocessing ${metadata.width}x${metadata.height} ${metadata.format} image with method: ${options.method}`);
      } catch (error) {
        if (error instanceof PreprocessorError) {
          throw error;
        }
        throw new PreprocessorError(
          'Invalid image data: unable to read image metadata',
          error
        );
      }

      // 根据方法选择预处理策略
      switch (options.method) {
        case 'canny':
          return await this.preprocessCanny(imageBuffer, options);
        case 'depth':
          return await this.preprocessDepth(imageBuffer, options);
        case 'pose':
          return await this.preprocessPose(imageBuffer, options);
        default:
          throw new PreprocessorError(`Unsupported preprocessor method: ${options.method}`);
      }
    } catch (error) {
      // 记录错误日志
      console.error('[ControlNet] Preprocessing failed:', {
        method: options.method,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof PreprocessorError) {
        throw error;
      }
      throw new PreprocessorError(
        `Preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Canny 边缘检测预处理
   * 使用 Laplacian 算子进行边缘检测
   */
  private async preprocessCanny(
    imageBuffer: Buffer,
    options: PreprocessorOptions
  ): Promise<Buffer> {
    try {
      // 获取图像元数据
      const metadata = await sharp(imageBuffer).metadata();
      
      // 1. 转换为灰度图
      let processedImage = sharp(imageBuffer).greyscale();

      // 2. 可选：应用高斯模糊以减少噪声
      const blurSigma = options.blurSigma || 1.0;
      if (blurSigma > 0) {
        processedImage = processedImage.blur(blurSigma);
      }

      // 3. 应用 Laplacian 边缘检测卷积核
      // Laplacian 算子用于检测图像中的边缘
      const laplacianKernel = {
        width: 3,
        height: 3,
        kernel: [
          -1, -1, -1,
          -1,  8, -1,
          -1, -1, -1
        ]
      };

      const edgeBuffer = await processedImage
        .convolve(laplacianKernel)
        .toBuffer();

      // 4. 归一化边缘检测结果
      // 将结果标准化到 0-255 范围，使边缘更清晰
      const normalizedBuffer = await sharp(edgeBuffer)
        .normalize()
        .toBuffer();

      // 5. 转换为黑白二值图像以获得更清晰的边缘
      // 使用阈值处理增强边缘对比度
      const finalBuffer = await sharp(normalizedBuffer)
        .threshold(128) // 阈值可以根据需要调整
        .png()
        .toBuffer();

      console.log(`[ControlNet] Canny preprocessing completed for ${metadata.width}x${metadata.height} image`);
      
      return finalBuffer;
    } catch (error) {
      console.error('[ControlNet] Canny preprocessing error:', error);
      throw new PreprocessorError(
        `Canny edge detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * 深度图预处理
   * 注意：这是一个简化实现，真实的深度估计需要专门的模型
   * 使用 Sobel 算子模拟深度信息
   */
  private async preprocessDepth(
    imageBuffer: Buffer,
    options: PreprocessorOptions
  ): Promise<Buffer> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      // 1. 转换为灰度图
      let processedImage = sharp(imageBuffer).greyscale();

      // 2. 应用高斯模糊
      const blurSigma = options.blurSigma || 2.0;
      processedImage = processedImage.blur(blurSigma);

      // 3. 使用 Sobel 算子检测梯度（模拟深度变化）
      // Sobel X 方向
      const sobelX = {
        width: 3,
        height: 3,
        kernel: [
          -1, 0, 1,
          -2, 0, 2,
          -1, 0, 1
        ]
      };

      const gradientBuffer = await processedImage
        .convolve(sobelX)
        .toBuffer();

      // 4. 归一化并反转（深度图通常是暗色表示远，亮色表示近）
      const depthBuffer = await sharp(gradientBuffer)
        .normalize()
        .negate() // 反转颜色
        .png()
        .toBuffer();

      console.log(`[ControlNet] Depth preprocessing completed for ${metadata.width}x${metadata.height} image`);
      
      return depthBuffer;
    } catch (error) {
      console.error('[ControlNet] Depth preprocessing error:', error);
      throw new PreprocessorError(
        `Depth preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * 姿态检测预处理
   * 注意：这是一个简化实现，真实的姿态检测需要专门的模型
   * 使用边缘检测和形态学操作模拟姿态骨架
   */
  private async preprocessPose(
    imageBuffer: Buffer,
    options: PreprocessorOptions
  ): Promise<Buffer> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      // 1. 转换为灰度图
      let processedImage = sharp(imageBuffer).greyscale();

      // 2. 应用轻微模糊
      const blurSigma = options.blurSigma || 0.5;
      if (blurSigma > 0) {
        processedImage = processedImage.blur(blurSigma);
      }

      // 3. 使用 Prewitt 算子进行边缘检测（比 Laplacian 更柔和）
      const prewittKernel = {
        width: 3,
        height: 3,
        kernel: [
          -1, -1, -1,
           0,  0,  0,
           1,  1,  1
        ]
      };

      const edgeBuffer = await processedImage
        .convolve(prewittKernel)
        .toBuffer();

      // 4. 归一化并增强对比度
      const poseBuffer = await sharp(edgeBuffer)
        .normalize()
        .linear(1.5, 0) // 增加对比度
        .threshold(100) // 二值化
        .png()
        .toBuffer();

      console.log(`[ControlNet] Pose preprocessing completed for ${metadata.width}x${metadata.height} image`);
      
      return poseBuffer;
    } catch (error) {
      console.error('[ControlNet] Pose preprocessing error:', error);
      throw new PreprocessorError(
        `Pose preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }
}

/**
 * 创建默认的预处理器实例
 */
export function createPreprocessor(): ControlNetPreprocessor {
  return new ControlNetPreprocessor();
}

/**
 * 验证预处理选项
 * @param options 预处理选项
 * @throws PreprocessorError 如果选项无效
 */
export function validatePreprocessorOptions(options: PreprocessorOptions): void {
  if (!options) {
    throw new PreprocessorError('Preprocessor options are required');
  }

  if (!options.method) {
    throw new PreprocessorError('Preprocessor method is required');
  }

  const validMethods: PreprocessorMethod[] = ['canny', 'depth', 'pose'];
  if (!validMethods.includes(options.method)) {
    throw new PreprocessorError(
      `Invalid preprocessor method: ${options.method}. Valid methods are: ${validMethods.join(', ')}`
    );
  }

  // 验证可选参数范围
  if (options.blurSigma !== undefined) {
    if (options.blurSigma < 0 || options.blurSigma > 10) {
      throw new PreprocessorError('blurSigma must be between 0 and 10');
    }
  }

  if (options.cannyLowThreshold !== undefined) {
    if (options.cannyLowThreshold < 0 || options.cannyLowThreshold > 255) {
      throw new PreprocessorError('cannyLowThreshold must be between 0 and 255');
    }
  }

  if (options.cannyHighThreshold !== undefined) {
    if (options.cannyHighThreshold < 0 || options.cannyHighThreshold > 255) {
      throw new PreprocessorError('cannyHighThreshold must be between 0 and 255');
    }
  }

  if (
    options.cannyLowThreshold !== undefined &&
    options.cannyHighThreshold !== undefined &&
    options.cannyLowThreshold >= options.cannyHighThreshold
  ) {
    throw new PreprocessorError('cannyLowThreshold must be less than cannyHighThreshold');
  }
}

/**
 * 创建默认的预处理选项
 * @param method 预处理方法
 * @returns 默认选项
 */
export function createDefaultOptions(method: PreprocessorMethod): PreprocessorOptions {
  const baseOptions: PreprocessorOptions = {
    method,
  };

  switch (method) {
    case 'canny':
      return {
        ...baseOptions,
        blurSigma: 1.0,
        cannyLowThreshold: 50,
        cannyHighThreshold: 150,
      };
    case 'depth':
      return {
        ...baseOptions,
        blurSigma: 2.0,
      };
    case 'pose':
      return {
        ...baseOptions,
        blurSigma: 0.5,
      };
    default:
      return baseOptions;
  }
}
