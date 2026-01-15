import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ValidationError, asyncHandler } from '../middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * GET /api/download/:imageId
 * 下载生成的卡牌图片
 */
router.get('/:imageId', asyncHandler(async (req, res) => {
  const { imageId } = req.params;
  
  // 验证imageId格式（防止路径遍历攻击）
  if (!imageId || imageId.includes('..') || imageId.includes('/') || imageId.includes('\\')) {
    throw new ValidationError('无效的图片ID');
  }
  
  // 支持多种文件名格式：
  // 1. 纯 UUID: fe8a4baa-2d57-4ddd-b7f4-7432c8197838
  // 2. 带前缀: card_fe8a4baa-2d57-4ddd-b7f4-7432c8197838
  // 3. 带前缀: artwork_fe8a4baa-2d57-4ddd-b7f4-7432c8197838
  // 4. 带边框前缀: card_framed_fe8a4baa-2d57-4ddd-b7f4-7432c8197838
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const prefixedUuidRegex = /^(card|artwork|card_framed)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(imageId) && !prefixedUuidRegex.test(imageId)) {
    throw new ValidationError('无效的图片ID格式');
  }
  
  // 构建文件路径（在generated目录中查找）
  const generatedDir = path.join(__dirname, '..', '..', 'generated');
  const filePath = path.join(generatedDir, `${imageId}.png`);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: '图片不存在或已被删除'
    });
  }
  
  console.log('Downloading image:', imageId);
  
  // 设置响应头
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${imageId}.png"`);
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年
  
  // 使用流式传输文件
  const fileStream = fs.createReadStream(filePath);
  
  fileStream.on('error', (error) => {
    console.error('File stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '文件读取失败'
      });
    }
  });
  
  fileStream.pipe(res);
}));

export default router;
