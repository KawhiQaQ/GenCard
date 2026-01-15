import { PromptInput } from '../../types/canvas';

export interface DynamicPromptInputProps {
  hasUploadedImage: boolean;
  promptInput: PromptInput;
  onContentPromptChange: (prompt: string) => void;
  onStylePromptChange: (prompt: string) => void;
  disabled?: boolean;
}

const MAX_PROMPT_LENGTH = 1000;

export default function DynamicPromptInput({
  hasUploadedImage,
  promptInput,
  onContentPromptChange,
  onStylePromptChange,
  disabled = false
}: DynamicPromptInputProps) {
  const contentPromptLength = promptInput.contentPrompt?.length || 0;
  const stylePromptLength = promptInput.stylePrompt?.length || 0;

  return (
    <div className="space-y-6">
      {/* 模式说明 */}
      {hasUploadedImage && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">内容保留模式：</span>
            检测到您已上传原画框图片，系统将自动保留原画框内的照片内容。您只需描述卡牌的整体风格即可。
          </p>
        </div>
      )}

      {/* 内容提示词输入框 - 仅在无上传图片时显示 */}
      {!hasUploadedImage && (
        <div>
          <label 
            htmlFor="content-prompt" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            内容提示词 (Content Prompt)
          </label>
          <textarea
            id="content-prompt"
            value={promptInput.contentPrompt || ''}
            onChange={(e) => onContentPromptChange(e.target.value)}
            placeholder="描述原画框内部的内容，例如：一个未来科技感的机器人，站在城市背景前，手持能量武器..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
            disabled={disabled}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">
              描述原画框内部的主要视觉内容
            </p>
            <p className="text-xs text-gray-500">
              {contentPromptLength}/{MAX_PROMPT_LENGTH}
            </p>
          </div>
          {/* 示例提示 */}
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
            <span className="font-semibold">示例：</span>
            一位穿着魔法长袍的女巫，手持魔杖，周围环绕着紫色的魔法光芒
          </div>
        </div>
      )}

      {/* 风格提示词输入框 - 始终显示 */}
      <div>
        <label 
          htmlFor="style-prompt" 
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          风格提示词 (Style Prompt) *
        </label>
        <textarea
          id="style-prompt"
          value={promptInput.stylePrompt}
          onChange={(e) => onStylePromptChange(e.target.value)}
          placeholder="描述卡牌的整体风格，例如：奇幻风格，紫色和金色主题，华丽的装饰边框，魔法光效..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
          disabled={disabled}
          maxLength={MAX_PROMPT_LENGTH}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-500">
            描述卡牌的整体风格、色调、装饰元素等
          </p>
          <p className="text-xs text-gray-500">
            {stylePromptLength}/{MAX_PROMPT_LENGTH}
          </p>
        </div>
        {/* 示例提示 */}
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
          <span className="font-semibold">示例：</span>
          科幻风格，蓝色和银色主题，带有光效和几何装饰元素，现代感强
        </div>
      </div>

      {/* 提示信息 */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-xs text-gray-600">
          <span className="font-semibold">提示：</span>
          {hasUploadedImage 
            ? '系统将保留您上传的原画框图片内容，并根据风格提示词对卡牌进行整体美化。'
            : '内容提示词描述原画框内的主体，风格提示词描述整体卡牌的艺术风格和装饰。两者结合将生成完整的卡牌设计。'
          }
        </p>
      </div>
    </div>
  );
}
