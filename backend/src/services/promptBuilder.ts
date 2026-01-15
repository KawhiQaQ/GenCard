import { LayoutDraft, TextBoxElement, ImageFrameElement } from '../types/index.js';

/**
 * 构建AI生成的Prompt
 * 根据内容提示词、风格提示词、布局信息和上传图片状态生成完整的AI提示词
 * 
 * @param contentPrompt - 内容提示词（描述原画框内容），如果有上传图片则为 null
 * @param stylePrompt - 风格提示词（描述卡牌整体风格）
 * @param layout - 布局草图数据
 * @param hasUploadedImages - 是否有上传的原画框图片
 * @returns 完整的AI提示词
 */
export function buildPrompt(
  contentPrompt: string | null,
  stylePrompt: string,
  layout: LayoutDraft,
  hasUploadedImages: boolean
): string {
  let prompt = '';

  // 1. 内容提示词处理（Sub-task 9.2）
  if (hasUploadedImages) {
    // 使用预设的内容保留提示词
    prompt += '保留原画框区域的照片内容，不要改变其主体和细节。';
    prompt += '确保原画框内的图片内容与参考图片高度一致。';
  } else if (contentPrompt && contentPrompt.trim()) {
    // 使用用户输入的内容提示词
    prompt += `原画框内容：${contentPrompt.trim()}。`;
  }

  // 2. 风格提示词合并（Sub-task 9.3）
  if (stylePrompt && stylePrompt.trim()) {
    prompt += `整体风格：${stylePrompt.trim()}。`;
  }

  // 3. 文字润色指令（Sub-task 9.4）
  const textBoxes = layout.elements.filter(e => e.type === 'textbox') as TextBoxElement[];
  if (textBoxes.length > 0) {
    prompt += '对文字框中的文字进行视觉美化，添加合适的字体效果、颜色和装饰，';
    prompt += '使文字更加美观和吸引人。';
    prompt += '但必须保持文字内容、位置和布局结构完全不变。';
    
    // 列出文字内容供参考
    textBoxes.forEach((textBox, index) => {
      prompt += `文字${index + 1}："${textBox.text}"。`;
    });
  }

  // 4. 边框美化指令（Sub-task 9.5）
  prompt += '对边框和装饰元素进行艺术化处理，添加材质、光影和细节效果，';
  prompt += '使其更加精美和富有质感。';
  prompt += '但必须保持边框的原始位置和形状不变，确保与整体卡牌风格协调一致。';

  // 5. 布局保持指令（Sub-task 9.6）
  prompt += '严格遵循草图的布局结构，不要改变任何元素的位置和大小。';
  prompt += '所有元素必须保持在其指定的位置和尺寸范围内。';

  // 6. 原画框内容保留指令（Sub-task 9.7）
  if (hasUploadedImages) {
    const imageFrames = layout.elements.filter(e => e.type === 'imageframe') as ImageFrameElement[];
    const framesWithImages = imageFrames.filter(frame => frame.uploadedImage);
    
    if (framesWithImages.length > 0) {
      prompt += '特别强调：原画框区域必须保留上传的参考图片内容。';
      prompt += '不要对原画框内的主体内容进行任何改变或替换。';
      prompt += '只能在不影响主体的前提下进行风格化的细节增强。';
    }
  }

  return prompt;
}

/**
 * 获取简化的Prompt用于日志记录
 */
export function getPromptSummary(prompt: string): string {
  if (prompt.length <= 100) {
    return prompt;
  }
  return prompt.substring(0, 97) + '...';
}

/**
 * 检测布局中是否有上传的图片
 * 
 * @param layout - 布局草图数据
 * @returns 是否有上传的图片
 */
export function hasUploadedImages(layout: LayoutDraft): boolean {
  const imageFrames = layout.elements.filter(e => e.type === 'imageframe') as ImageFrameElement[];
  return imageFrames.some(frame => frame.uploadedImage && frame.uploadedImage.id);
}

/**
 * 构建AI生成的Prompt（旧版兼容接口）
 * 用于向后兼容旧的 DALL-E 生成流程
 * 
 * @param request - 旧格式的生成请求
 * @returns AI提示词
 */
export function buildAIPrompt(request: any): string {
  const { layout, prompt, preserveBorders, uploadedImages } = request;
  
  // 检测是否有上传的图片
  const hasImages = uploadedImages && uploadedImages.length > 0;
  
  // 使用新的 buildPrompt 函数
  return buildPrompt(
    hasImages ? null : prompt,
    prompt || '',
    layout,
    hasImages
  );
}
