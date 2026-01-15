import { fabric } from 'fabric';
import { LayoutDraft, TextBoxElement, ImageFrameElement, CanvasConfig } from '../types/canvas';

/**
 * 导出画布为 base64 编码的 PNG 图像
 * @param canvas Fabric.js 画布实例
 * @returns base64 编码的图像字符串 (data:image/png;base64,...)
 */
export function exportCanvasAsImage(canvas: fabric.Canvas): string {
  return canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: 1
  });
}

export function exportLayout(
  canvas: fabric.Canvas,
  config: CanvasConfig
): LayoutDraft {
  const objects = canvas.getObjects();
  const elements: (TextBoxElement | ImageFrameElement)[] = [];

  objects.forEach((obj, index) => {
    const id = `element-${index}-${Date.now()}`;

    if (obj.type === 'textbox') {
      const textbox = obj as fabric.Textbox;
      const element: TextBoxElement = {
        id,
        type: 'textbox',
        x: Math.round(textbox.left || 0),
        y: Math.round(textbox.top || 0),
        width: Math.round((textbox.width || 0) * (textbox.scaleX || 1)),
        height: Math.round((textbox.height || 0) * (textbox.scaleY || 1)),
        text: textbox.text || '',
        fontSize: textbox.fontSize || 20,
        hasBorder: true
      };
      elements.push(element);
    } else if (obj.type === 'rect' && (obj as any).elementType === 'imageframe') {
      const rect = obj as fabric.Rect;
      const uploadedImage = (obj as any).uploadedImage;
      
      const element: ImageFrameElement = {
        id,
        type: 'imageframe',
        x: Math.round(rect.left || 0),
        y: Math.round(rect.top || 0),
        width: Math.round((rect.width || 0) * (rect.scaleX || 1)),
        height: Math.round((rect.height || 0) * (rect.scaleY || 1)),
        uploadedImage: uploadedImage ? {
          id: uploadedImage.id,
          url: uploadedImage.url,
          file: uploadedImage.file
        } : undefined
      };
      elements.push(element);
    }
  });

  return {
    canvas: config,
    elements
  };
}
