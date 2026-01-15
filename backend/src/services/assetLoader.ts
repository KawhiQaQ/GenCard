/**
 * Asset Loader - 边框资源加载服务
 * 
 * 本文件实现了边框资源文件的加载、缓存和验证功能。
 * 支持 SVG 和 PNG 格式的资源文件。
 * 
 * Requirements: 7.1, 7.2, 7.4, 7.5
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * 资源缓存
 * 
 * 使用 Map 存储已加载的资源，键为资源路径，值为 Buffer
 * 
 * Requirements: 7.2
 */
const assetCache: Map<string, Buffer> = new Map();

/**
 * 资源加载时间记录（用于性能分析）
 */
const loadTimeCache: Map<string, number> = new Map();

/**
 * 获取资源文件的完整路径
 * 
 * @param assetPath - 相对资源路径（如 'frames/cyber/corner.svg'）
 * @returns 完整的文件系统路径
 */
function getFullAssetPath(assetPath: string): string {
  // 资源文件存储在 backend/assets/ 目录下
  return path.join(process.cwd(), 'assets', assetPath);
}

/**
 * 验证资源文件是否存在
 * 
 * @param assetPath - 相对资源路径
 * @returns 资源文件是否存在
 * 
 * Requirements: 7.4
 */
export function validateAssetExists(assetPath: string): boolean {
  if (!assetPath || assetPath.trim() === '') {
    return false;
  }
  
  const fullPath = getFullAssetPath(assetPath);
  return fs.existsSync(fullPath);
}

/**
 * 获取资源文件的格式
 * 
 * @param assetPath - 资源路径
 * @returns 文件格式（'svg' | 'png' | 'unknown'）
 */
function getAssetFormat(assetPath: string): 'svg' | 'png' | 'unknown' {
  const ext = path.extname(assetPath).toLowerCase();
  if (ext === '.svg') return 'svg';
  if (ext === '.png') return 'png';
  return 'unknown';
}

/**
 * 加载资源文件
 * 
 * 支持 SVG 和 PNG 格式，自动使用缓存提高性能。
 * SVG 文件会被转换为 PNG Buffer 以便后续处理。
 * 
 * @param assetPath - 相对资源路径（如 'frames/cyber/corner.svg'）
 * @returns 资源文件的 Buffer
 * @throws Error 如果资源文件不存在或格式不支持
 * 
 * Requirements: 7.2, 7.5
 */
export async function loadAsset(assetPath: string): Promise<Buffer> {
  // 检查缓存
  if (assetCache.has(assetPath)) {
    return assetCache.get(assetPath)!;
  }

  const startTime = Date.now();
  const fullPath = getFullAssetPath(assetPath);

  // 验证文件存在
  if (!validateAssetExists(assetPath)) {
    throw new Error(`边框资源文件不存在: ${assetPath}`);
  }

  const format = getAssetFormat(assetPath);
  
  if (format === 'unknown') {
    throw new Error(`不支持的资源格式: ${assetPath}，仅支持 SVG 和 PNG 格式`);
  }

  let buffer: Buffer;

  if (format === 'svg') {
    // SVG 文件：读取并转换为 PNG Buffer
    const svgContent = fs.readFileSync(fullPath);
    buffer = await sharp(svgContent)
      .png()
      .toBuffer();
  } else {
    // PNG 文件：直接读取
    buffer = fs.readFileSync(fullPath);
  }

  // 存入缓存
  assetCache.set(assetPath, buffer);
  
  // 记录加载时间
  const loadTime = Date.now() - startTime;
  loadTimeCache.set(assetPath, loadTime);

  return buffer;
}

/**
 * 加载资源文件并调整尺寸
 * 
 * @param assetPath - 相对资源路径
 * @param width - 目标宽度
 * @param height - 目标高度
 * @returns 调整尺寸后的资源 Buffer
 * 
 * Requirements: 7.5
 */
export async function loadAssetWithSize(
  assetPath: string,
  width: number,
  height: number
): Promise<Buffer> {
  const buffer = await loadAsset(assetPath);
  
  return sharp(buffer)
    .resize(width, height, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

/**
 * 清除资源缓存
 * 
 * 清除所有已缓存的资源，释放内存。
 * 
 * Requirements: 7.2
 */
export function clearAssetCache(): void {
  assetCache.clear();
  loadTimeCache.clear();
}

/**
 * 获取缓存统计信息
 * 
 * @returns 缓存统计对象，包含缓存大小和已缓存的资源路径列表
 * 
 * Requirements: 7.2
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: assetCache.size,
    keys: Array.from(assetCache.keys()),
  };
}

/**
 * 获取资源加载时间
 * 
 * @param assetPath - 资源路径
 * @returns 加载时间（毫秒），如果未记录则返回 undefined
 */
export function getLoadTime(assetPath: string): number | undefined {
  return loadTimeCache.get(assetPath);
}

/**
 * 预加载多个资源
 * 
 * 批量加载资源文件到缓存中，提高后续渲染性能。
 * 
 * @param assetPaths - 资源路径数组
 * @returns 加载结果数组，包含每个资源的加载状态
 */
export async function preloadAssets(
  assetPaths: string[]
): Promise<Array<{ path: string; success: boolean; error?: string }>> {
  const results: Array<{ path: string; success: boolean; error?: string }> = [];

  for (const assetPath of assetPaths) {
    try {
      await loadAsset(assetPath);
      results.push({ path: assetPath, success: true });
    } catch (error) {
      results.push({
        path: assetPath,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * 检查资源是否已缓存
 * 
 * @param assetPath - 资源路径
 * @returns 是否已缓存
 */
export function isAssetCached(assetPath: string): boolean {
  return assetCache.has(assetPath);
}
