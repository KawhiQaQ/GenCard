import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

/**
 * 自定义错误类
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 文件上传错误
 */
export class FileUploadError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * AI服务错误
 */
export class AIServiceError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode);
  }
}

/**
 * 图像处理错误
 */
export class ImageProcessingError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * 统一错误处理中间件
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 记录错误日志
  console.error('=== Error Handler ===');
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('=====================');

  // 处理Multer错误（文件上传）
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: '文件大小超过限制（最大10MB）'
      });
      return;
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        error: '上传文件数量超过限制'
      });
      return;
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        success: false,
        error: '上传了意外的文件字段'
      });
      return;
    }
    
    res.status(400).json({
      success: false,
      error: `文件上传错误: ${err.message}`
    });
    return;
  }

  // 处理自定义应用错误
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
    return;
  }

  // 处理OpenAI API错误
  if (err.name === 'OpenAIError' || (err as any).status) {
    const status = (err as any).status || 500;
    let message = err.message;

    if (status === 401) {
      message = 'OpenAI API密钥无效，请检查配置';
    } else if (status === 429) {
      message = 'API调用频率超限，请稍后重试';
    } else if (status === 500) {
      message = 'OpenAI服务暂时不可用，请稍后重试';
    }

    res.status(status >= 500 ? 503 : status).json({
      success: false,
      error: message
    });
    return;
  }

  // 处理超时错误
  if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
    res.status(504).json({
      success: false,
      error: '请求超时，请稍后重试'
    });
    return;
  }

  // 处理网络错误
  if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
    res.status(503).json({
      success: false,
      error: '服务暂时不可用，请稍后重试'
    });
    return;
  }

  // 处理文件系统错误
  if (err.message.includes('ENOENT')) {
    res.status(404).json({
      success: false,
      error: '请求的文件不存在'
    });
    return;
  }

  if (err.message.includes('EACCES') || err.message.includes('EPERM')) {
    res.status(500).json({
      success: false,
      error: '文件访问权限错误'
    });
    return;
  }

  // 处理Sharp图像处理错误
  if (err.message.includes('Input file') || err.message.includes('sharp')) {
    res.status(400).json({
      success: false,
      error: '图像文件损坏或格式不支持'
    });
    return;
  }

  // 处理JSON解析错误
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: '请求数据格式错误'
    });
    return;
  }

  // 默认错误响应
  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误，请稍后重试'
    : err.message || '未知错误';

  res.status(statusCode).json({
    success: false,
    error: message
  });
}

/**
 * 404错误处理
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `路径 ${req.path} 不存在`
  });
}

/**
 * 异步路由处理器包装器
 * 自动捕获异步错误并传递给错误处理中间件
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
