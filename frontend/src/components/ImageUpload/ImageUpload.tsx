import React, { useState, useRef } from 'react';
import { uploadImage, validateUploadFile } from '../../services/api';
import { ImageFrameElement } from '../../types/canvas';

interface UploadedImage {
  id: string;
  url: string;
  file: File;
  elementId?: string;
  applyStyleTransform: boolean;
}

interface ImageUploadProps {
  imageFrames: ImageFrameElement[];
  onImageUploaded: (elementId: string, imageId: string, applyStyleTransform: boolean) => void;
  onImageRemoved: (elementId: string) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  imageFrames,
  onImageUploaded,
  onImageRemoved
}) => {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string>('');
  const [applyStyleTransform, setApplyStyleTransform] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 使用统一的验证函数
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      setError(validation.error || '文件验证失败');
      return;
    }

    if (!selectedElementId) {
      setError('请先选择一个原画框');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const response = await uploadImage(file);
      
      if (response.success && response.imageId && response.url) {
        const newImage: UploadedImage = {
          id: response.imageId,
          url: response.url,
          file,
          elementId: selectedElementId,
          applyStyleTransform
        };

        setUploadedImages(prev => [...prev, newImage]);
        onImageUploaded(selectedElementId, response.imageId, applyStyleTransform);
        
        // Reset form
        setSelectedElementId('');
        setApplyStyleTransform(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError(response.error || '上传失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (imageId: string, elementId?: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
    if (elementId) {
      onImageRemoved(elementId);
    }
  };

  const getImageFrameName = (elementId: string) => {
    const index = imageFrames.findIndex(frame => frame.id === elementId);
    return index >= 0 ? `原画框 ${index + 1}` : elementId;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">图片上传</h3>
      
      {/* Upload Form */}
      <div className="border rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            选择原画框
          </label>
          <select
            value={selectedElementId}
            onChange={(e) => setSelectedElementId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            disabled={uploading || imageFrames.length === 0}
          >
            <option value="">-- 请选择 --</option>
            {imageFrames.map((frame, index) => (
              <option key={frame.id} value={frame.id}>
                原画框 {index + 1} ({frame.width}x{frame.height})
              </option>
            ))}
          </select>
        </div>

        {imageFrames.length === 0 && (
          <p className="text-sm text-gray-500">
            请先在画布上添加原画框元素
          </p>
        )}

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={applyStyleTransform}
              onChange={(e) => setApplyStyleTransform(e.target.checked)}
              disabled={uploading}
              className="rounded"
            />
            <span className="text-sm">应用风格变换</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            勾选后，AI将根据提示词对图片进行风格变换；不勾选则直接使用原图
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            选择图片文件
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={uploading || !selectedElementId}
            className="w-full text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            支持 JPG、PNG、WEBP 格式，最大 10MB
          </p>
        </div>

        {uploading && (
          <div className="text-sm text-blue-600">
            上传中...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Uploaded Images List */}
      {uploadedImages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">已上传图片</h4>
          <div className="space-y-2">
            {uploadedImages.map((image) => (
              <div
                key={image.id}
                className="flex items-center space-x-3 border rounded-lg p-3"
              >
                <img
                  src={image.url}
                  alt="Uploaded"
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {image.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {image.elementId && `关联: ${getImageFrameName(image.elementId)}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {image.applyStyleTransform ? '应用风格变换' : '直接使用原图'}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveImage(image.id, image.elementId)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
