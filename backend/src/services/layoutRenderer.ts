import sharp from 'sharp';
import { LayoutDraft, TextBoxElement, ImageFrameElement } from '../types/index.js';

/**
 * 渲染布局基础图
 * 创建包含所有文本框和原画框边框的基础画布图像
 */
export async function renderLayoutBase(layout: LayoutDraft): Promise<Buffer> {
  const { canvas, elements } = layout;
  
  // 创建基础白色画布
  const baseImage = sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });
  
  // 生成SVG元素
  const svgElements: string[] = [];
  
  for (const element of elements) {
    if (element.type === 'textbox') {
      const textBox = element as TextBoxElement;
      
      // 绘制文本框边框
      if (textBox.hasBorder) {
        svgElements.push(`
          <rect 
            x="${textBox.x}" 
            y="${textBox.y}" 
            width="${textBox.width}" 
            height="${textBox.height}"
            fill="none" 
            stroke="black" 
            stroke-width="2"
          />
        `);
      }
      
      // 绘制文本内容
      // 使用简单的文本渲染，实际位置需要考虑字体大小
      const textY = textBox.y + textBox.fontSize + 5; // 添加一些padding
      svgElements.push(`
        <text 
          x="${textBox.x + 5}" 
          y="${textY}" 
          font-size="${textBox.fontSize}"
          font-family="Arial, sans-serif"
          fill="black"
        >${escapeXml(textBox.text)}</text>
      `);
    } else if (element.type === 'imageframe') {
      const imageFrame = element as ImageFrameElement;
      
      // 绘制原画框边框（使用灰色填充表示占位符）
      svgElements.push(`
        <rect 
          x="${imageFrame.x}" 
          y="${imageFrame.y}" 
          width="${imageFrame.width}" 
          height="${imageFrame.height}"
          fill="#f0f0f0" 
          stroke="black" 
          stroke-width="2"
        />
      `);
      
      // 添加占位符文本
      const centerX = imageFrame.x + imageFrame.width / 2;
      const centerY = imageFrame.y + imageFrame.height / 2;
      svgElements.push(`
        <text 
          x="${centerX}" 
          y="${centerY}" 
          font-size="14"
          font-family="Arial, sans-serif"
          fill="#666666"
          text-anchor="middle"
          dominant-baseline="middle"
        >Image Frame</text>
      `);
    }
  }
  
  // 构建完整的SVG
  const svg = `
    <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements.join('\n')}
    </svg>
  `;
  
  // 将SVG合成到基础画布上
  const result = await baseImage
    .composite([{
      input: Buffer.from(svg),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();
  
  return result;
}

/**
 * 转义XML特殊字符
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
