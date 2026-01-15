import React, { useState, useRef } from 'react';
import { ArtworkData, LayoutMode } from '../../types/canvas';
import { uploadImage, validateUploadFile } from '../../services/api';
import { ARTWORK_SIZE_BY_MODE } from '../../constants/cardLayout';

/**
 * ArtworkStage 组件的 Props 接口
 * 第一阶段：原画生成或上传
 */
export interface ArtworkStageProps {
  /** 原画准备完成的回调函数 */
  onArtworkReady: (artwork: ArtworkData) => void;
  /** 是否正在生成中 */
  isGenerating: boolean;
  /** 生成原画的回调函数，支持传递宽高参数 */
  onGenerateArtwork: (prompt: string, width?: number, height?: number) => Promise<void>;
  /** 当前原画数据（可选，用于预览） */
  artwork?: ArtworkData | null;
  /** 错误信息 */
  error?: string | null;
}

/**
 * ArtworkStage 组件
 * 第一阶段：用户通过提示词生成聚焦人物的原画，或上传已有图片跳过生成
 */
export const ArtworkStage: React.FC<ArtworkStageProps> = ({
  onArtworkReady,
  isGenerating,
  onGenerateArtwork,
  artwork,
  error
}) => {
  const [prompt, setPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewArtwork, setPreviewArtwork] = useState<ArtworkData | null>(artwork || null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('landscape');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取当前布局模式对应的原画尺寸
  const currentArtworkSize = ARTWORK_SIZE_BY_MODE[layoutMode];

  /**
   * 处理生成原画
   */
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }
    setUploadError(null);
    // 根据布局模式传递对应的宽高参数
    await onGenerateArtwork(prompt, currentArtworkSize.width, currentArtworkSize.height);
  };

  /**
   * 处理文件选择上传
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 清除之前的错误
    setUploadError(null);

    // 验证文件格式和大小
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || '文件验证失败');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);

    try {
      const response = await uploadImage(file);
      
      if (response.success && response.imageId && response.url) {
        const uploadedArtwork: ArtworkData = {
          imageUrl: response.url,
          isUploaded: true,
          layoutMode: layoutMode  // 携带当前选择的布局模式
        };
        setPreviewArtwork(uploadedArtwork);
      } else {
        setUploadError(response.error || '上传失败');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * 触发文件选择对话框
   */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 确认使用当前原画
   */
  const handleConfirm = () => {
    if (previewArtwork) {
      // 确保传递的 ArtworkData 包含当前的 layoutMode
      const artworkWithMode: ArtworkData = {
        ...previewArtwork,
        layoutMode: layoutMode
      };
      onArtworkReady(artworkWithMode);
    }
  };

  /**
   * 重新生成/清除预览
   */
  const handleRegenerate = () => {
    setPreviewArtwork(null);
    setUploadError(null);
  };

  // 当外部 artwork 变化时更新预览
  React.useEffect(() => {
    if (artwork) {
      setPreviewArtwork(artwork);
    }
  }, [artwork]);

  const displayError = error || uploadError;
  const isLoading = isGenerating || uploading;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">第一步：准备原画</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：输入区域 */}
          <div className="space-y-6">
            {/* 布局模式选择器 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                布局模式
              </label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setLayoutMode('landscape')}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    layoutMode === 'landscape'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <svg className="w-8 h-6 mb-1" viewBox="0 0 32 24" fill="currentColor">
                      <rect x="1" y="1" width="30" height="22" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                    <span>横版</span>
                    <span className="text-xs text-gray-500">720×1280</span>
                  </div>
                </button>
                <button
                  onClick={() => setLayoutMode('portrait')}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    layoutMode === 'portrait'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    <svg className="w-6 h-8 mb-1" viewBox="0 0 24 32" fill="currentColor">
                      <rect x="1" y="1" width="22" height="30" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    </svg>
                    <span>竖版</span>
                    <span className="text-xs text-gray-500">1024×1024</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 提示词输入 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                人物描述提示词
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想要生成的人物，例如：一位身穿银色铠甲的女骑士，金色长发，手持长剑，英姿飒爽..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                提示：描述人物特征、服装、姿态等，系统会自动聚焦人物主体
              </p>
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isLoading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  生成中...
                </span>
              ) : '生成原画'}
            </button>

            {/* 分隔线 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">或者</span>
              </div>
            </div>

            {/* 上传按钮 */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={isLoading}
                className="hidden"
                aria-label="选择图片文件"
              />
              
              <button
                onClick={handleUploadClick}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    上传中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    上传已有图片
                  </span>
                )}
              </button>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>支持格式：JPG、PNG、WEBP，最大 10MB</p>
                <p>推荐尺寸：{currentArtworkSize.width} x {currentArtworkSize.height} 像素（{layoutMode === 'landscape' ? '竖版原画' : '正方形'}）</p>
              </div>
            </div>

            {/* 错误提示 */}
            {displayError && (
              <div className="text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{displayError}</span>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：预览区域 */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              原画预览
            </label>
            
            <div 
              className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200"
              style={{ 
                aspectRatio: `${currentArtworkSize.width} / ${currentArtworkSize.height}`,
                maxHeight: '500px'
              }}
            >
              {previewArtwork ? (
                <>
                  <img
                    src={previewArtwork.imageUrl}
                    alt="原画预览"
                    className="w-full h-full object-cover"
                  />
                  {/* 来源标签 */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      previewArtwork.isUploaded 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {previewArtwork.isUploaded ? '已上传' : 'AI 生成'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">生成或上传原画后在此预览</p>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            {previewArtwork && (
              <div className="flex space-x-4">
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  确认使用
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  重新选择
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtworkStage;
