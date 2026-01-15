import React, { useState, useRef } from 'react';
import { uploadImage, validateUploadFile } from '../../services/api';

/**
 * ImageFrameUpload 组件的 Props 接口
 * 用于为单个原画框提供图片上传功能
 */
export interface ImageFrameUploadProps {
  /** 原画框的唯一标识符 */
  frameId: string;
  /** 上传成功的回调函数 */
  onUpload: (frameId: string, file: File, imageId: string, url: string) => Promise<void>;
  /** 删除图片的回调函数 */
  onRemove: (frameId: string) => void;
  /** 已上传的图片信息（可选） */
  uploadedImage?: {
    id: string;
    url: string;
  };
}

/**
 * ImageFrameUpload 组件
 * 为原画框提供图片上传、预览和删除功能
 */
export const ImageFrameUpload: React.FC<ImageFrameUploadProps> = ({
  frameId,
  onUpload,
  onRemove,
  uploadedImage
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 清除之前的错误
    setError(null);

    // 验证文件格式和大小
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      setError(validation.error || '文件验证失败');
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);

    try {
      // 调用 uploadImage API
      const response = await uploadImage(file);
      
      if (response.success && response.imageId && response.url) {
        // 调用父组件的回调函数
        await onUpload(frameId, file, response.imageId, response.url);
        // 清除图片加载错误状态
        setImageLoadError(false);
      } else {
        setError(response.error || '上传失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  /**
   * 触发文件选择对话框
   */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 处理删除图片
   */
  const handleRemoveImage = () => {
    setError(null);
    setImageLoadError(false);
    onRemove(frameId);
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 处理图片加载错误
   */
  const handleImageLoadError = () => {
    setImageLoadError(true);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">原画框图片</h4>
      
      <div className="text-xs text-gray-500">
        上传图片到此原画框，生成时将保留图片内容
      </div>

      {/* 图片预览 */}
      {uploadedImage && !imageLoadError && (
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          <img
            src={uploadedImage.url}
            alt="已上传的图片"
            className="w-full h-48 object-contain"
            onError={handleImageLoadError}
          />
          
          {/* 删除按钮 */}
          <button
            onClick={handleRemoveImage}
            disabled={uploading}
            className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:bg-gray-400 transition-colors shadow-lg"
            title="删除图片"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* 图片加载错误提示 */}
      {uploadedImage && imageLoadError && (
        <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
          <div className="flex items-center space-x-2 text-red-600 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">图片加载失败</span>
          </div>
          <p className="text-xs text-red-600 mb-3">无法显示图片，可能已被删除或链接失效</p>
          <button
            onClick={handleRemoveImage}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            移除此图片
          </button>
        </div>
      )}

      {/* 文件选择按钮和隐藏的 input 元素 */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          aria-label="选择图片文件"
        />
        
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? '上传中...' : uploadedImage ? '更换图片' : '选择图片'}
        </button>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>支持格式：JPG、PNG、WEBP</p>
          <p>文件大小：最大 10MB</p>
        </div>
      </div>

      {/* 上传进度提示 */}
      {uploading && (
        <div className="flex items-center space-x-2 text-sm text-blue-600">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>正在上传...</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
};
