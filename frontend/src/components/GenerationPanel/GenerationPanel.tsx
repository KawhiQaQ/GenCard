import { useState } from 'react';
import { LayoutDraft, GenerationRequest, PromptInput } from '../../types/canvas';
import DynamicPromptInput from '../DynamicPromptInput';

interface GenerationPanelProps {
  layout: LayoutDraft;
  uploadedImages: { [elementId: string]: string }; // Deprecated: kept for backward compatibility
  onGenerate: (request: GenerationRequest) => void;
  onBack: () => void;
  isGenerating: boolean;
}

export default function GenerationPanel({
  layout,
  uploadedImages: _uploadedImages, // Renamed to indicate it's unused
  onGenerate,
  onBack,
  isGenerating
}: GenerationPanelProps) {
  // 检测是否有上传的原画框图片 - 从 layout 元素中检查
  const hasUploadedImage = layout.elements.some(
    element => element.type === 'imageframe' && element.uploadedImage
  );

  // 使用新的 PromptInput 状态
  const [promptInput, setPromptInput] = useState<PromptInput>({
    contentPrompt: hasUploadedImage ? null : '',
    stylePrompt: ''
  });

  const handleContentPromptChange = (prompt: string) => {
    setPromptInput(prev => ({
      ...prev,
      contentPrompt: prompt
    }));
  };

  const handleStylePromptChange = (prompt: string) => {
    setPromptInput(prev => ({
      ...prev,
      stylePrompt: prompt
    }));
  };

  const handleGenerate = () => {
    // 验证风格提示词（必填）
    if (!promptInput.stylePrompt.trim()) {
      alert('请输入风格提示词');
      return;
    }

    // 如果没有上传图片，验证内容提示词
    if (!hasUploadedImage && !promptInput.contentPrompt?.trim()) {
      alert('请输入内容提示词');
      return;
    }

    const request: GenerationRequest = {
      layout,
      promptInput: {
        contentPrompt: hasUploadedImage ? null : promptInput.contentPrompt?.trim() || null,
        stylePrompt: promptInput.stylePrompt.trim()
      }
    };

    onGenerate(request);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">生成配置</h2>

      {/* 布局信息 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold mb-2">布局信息</h3>
        <p className="text-sm text-gray-600">
          画布尺寸: {layout.canvas.width} × {layout.canvas.height}
        </p>
        <p className="text-sm text-gray-600">
          元素数量: {layout.elements.length}
        </p>
      </div>

      {/* Prompt输入 - 使用 DynamicPromptInput 组件 */}
      <div className="mb-6">
        <DynamicPromptInput
          hasUploadedImage={hasUploadedImage}
          promptInput={promptInput}
          onContentPromptChange={handleContentPromptChange}
          onStylePromptChange={handleStylePromptChange}
          disabled={isGenerating}
        />
      </div>

      {/* 按钮组 */}
      <div className="flex space-x-4">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          返回编辑
        </button>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !promptInput.stylePrompt.trim() || (!hasUploadedImage && !promptInput.contentPrompt?.trim())}
          className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              生成中...
            </span>
          ) : (
            '开始生成'
          )}
        </button>
      </div>

      {/* 生成中提示 */}
      {isGenerating && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 text-center">
            AI正在生成您的卡牌，这可能需要一些时间，请耐心等待...
          </p>
        </div>
      )}
    </div>
  );
}
