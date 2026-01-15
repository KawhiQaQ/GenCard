import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { CanvasConfig, LayoutDraft } from '../../types/canvas';
import ElementToolbar from './ElementToolbar';
import PropertyPanel from './PropertyPanel';
import { exportLayout, exportCanvasAsImage } from '../../utils/canvasExport';

// 预设尺寸配置
const PRESET_SIZES = [
  { label: '正方形 (1024×1024)', width: 1024, height: 1024 },
  { label: '竖版 (768×1024)', width: 768, height: 1024 },
  { label: '横版 (1024×768)', width: 1024, height: 768 }
] as const;

type PresetSize = typeof PRESET_SIZES[number];

interface CanvasEditorProps {
  onCanvasReady?: (canvas: fabric.Canvas) => void;
  onExportLayout?: (layout: LayoutDraft) => void;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ onCanvasReady, onExportLayout }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  
  // 默认选择 1024×1024 (正方形)
  const [selectedPreset, setSelectedPreset] = useState<PresetSize>(PRESET_SIZES[0]);
  
  const [config, setConfig] = useState<CanvasConfig>({
    width: PRESET_SIZES[0].width,
    height: PRESET_SIZES[0].height,
    cornerRadius: 0,
    backgroundColor: '#ffffff'
  });

  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 初始化Fabric.js画布
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      selection: true,
    });

    fabricCanvasRef.current = canvas;

    // 监听选择事件
    canvas.on('selection:created', (e) => {
      setSelectedObject(e.selected?.[0] || null);
      setHasSelection(true);
    });

    canvas.on('selection:updated', (e) => {
      setSelectedObject(e.selected?.[0] || null);
      setHasSelection(true);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
      setHasSelection(false);
    });

    // 监听对象修改事件
    canvas.on('object:modified', () => {
      setSelectedObject(canvas.getActiveObject());
      syncImageFrameWithUploadedImage(canvas.getActiveObject());
    });

    // 监听对象移动事件
    canvas.on('object:moving', (e) => {
      syncImageFrameWithUploadedImage(e.target);
    });

    // 监听对象缩放事件
    canvas.on('object:scaling', (e) => {
      syncImageFrameWithUploadedImage(e.target);
    });

    // 通知父组件画布已准备好
    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    return () => {
      canvas.dispose();
    };
  }, []);

  // 更新画布配置
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.setWidth(config.width);
    canvas.setHeight(config.height);
    canvas.setBackgroundColor(config.backgroundColor, () => {
      canvas.renderAll();
    });
  }, [config]);

  const handleConfigChange = (field: keyof CanvasConfig, value: number | string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 处理预设尺寸切换
  const handlePresetChange = (preset: PresetSize) => {
    setSelectedPreset(preset);
    
    const newWidth = preset.width;
    const newHeight = preset.height;
    
    // 更新配置
    setConfig(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight
    }));
    
    // 调整超出边界的元素位置
    if (fabricCanvasRef.current) {
      adjustElementsWithinBounds(fabricCanvasRef.current, newWidth, newHeight);
    }
  };

  // 将超出边界的元素移动到边界内
  const adjustElementsWithinBounds = (canvas: fabric.Canvas, canvasWidth: number, canvasHeight: number) => {
    const objects = canvas.getObjects();
    
    objects.forEach(obj => {
      if (!obj) return;
      
      const objLeft = obj.left || 0;
      const objTop = obj.top || 0;
      const objWidth = (obj.width || 0) * (obj.scaleX || 1);
      const objHeight = (obj.height || 0) * (obj.scaleY || 1);
      
      let newLeft = objLeft;
      let newTop = objTop;
      let needsUpdate = false;
      
      // 检查右边界
      if (objLeft + objWidth > canvasWidth) {
        newLeft = Math.max(0, canvasWidth - objWidth);
        needsUpdate = true;
      }
      
      // 检查下边界
      if (objTop + objHeight > canvasHeight) {
        newTop = Math.max(0, canvasHeight - objHeight);
        needsUpdate = true;
      }
      
      // 检查左边界
      if (objLeft < 0) {
        newLeft = 0;
        needsUpdate = true;
      }
      
      // 检查上边界
      if (objTop < 0) {
        newTop = 0;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        obj.set({
          left: newLeft,
          top: newTop
        });
        
        // 同步关联的图片和标识
        syncImageFrameWithUploadedImage(obj);
      }
    });
    
    canvas.renderAll();
  };

  // 同步原画框与上传图片的位置和大小
  const syncImageFrameWithUploadedImage = (obj: fabric.Object | null | undefined) => {
    if (!obj || !fabricCanvasRef.current) return;
    
    const isImageFrame = obj.type === 'rect' && (obj as any).elementType === 'imageframe';
    if (!isImageFrame) return;

    const imageObject = (obj as any).uploadedImageObject;
    const indicator = (obj as any).imageIndicator;
    
    if (!imageObject) return;

    const rect = obj as fabric.Rect;
    const frameWidth = (rect.width || 200) * (rect.scaleX || 1);
    const frameHeight = (rect.height || 200) * (rect.scaleY || 1);

    // 更新图片位置和大小
    imageObject.set({
      left: rect.left,
      top: rect.top
    });

    imageObject.scaleToWidth(frameWidth);
    imageObject.scaleToHeight(frameHeight);

    // 更新标识位置
    if (indicator) {
      indicator.set({
        left: (rect.left || 0) + 10,
        top: (rect.top || 0) + 10
      });
    }

    fabricCanvasRef.current.renderAll();
  };

  const handleAddTextBox = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const textbox = new fabric.Textbox('文本', {
      left: 100,
      top: 100,
      width: 150,
      fontSize: 20,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 1,
      borderColor: '#2196F3',
      cornerColor: '#2196F3',
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
  };

  const handleAddImageFrame = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 200,
      height: 200,
      fill: '#f0f0f0',
      stroke: '#000000',
      strokeWidth: 2,
      borderColor: '#4CAF50',
      cornerColor: '#4CAF50',
    });

    // 添加自定义属性标识这是原画框
    (rect as any).elementType = 'imageframe';
    (rect as any).frameId = `frame-${Date.now()}`;
    (rect as any).uploadedImage = undefined;

    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  };

  const handleDeleteElement = () => {
    if (!fabricCanvasRef.current || !selectedObject) return;

    const canvas = fabricCanvasRef.current;
    
    // 如果删除的是原画框，也要删除关联的图片和标识
    const isImageFrame = selectedObject.type === 'rect' && (selectedObject as any).elementType === 'imageframe';
    if (isImageFrame) {
      const imageObject = (selectedObject as any).uploadedImageObject;
      if (imageObject) {
        canvas.remove(imageObject);
      }
      
      const indicator = (selectedObject as any).imageIndicator;
      if (indicator) {
        canvas.remove(indicator);
      }
    }
    
    canvas.remove(selectedObject);
    canvas.renderAll();
    setSelectedObject(null);
    setHasSelection(false);
  };

  const handlePropertyUpdate = () => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.renderAll();
  };

  const handleImageUpload = async (frameId: string, file: File, imageId: string, url: string) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    
    // 找到对应的原画框对象
    const frameObject = objects.find(obj => 
      obj.type === 'rect' && 
      (obj as any).elementType === 'imageframe' && 
      (obj as any).frameId === frameId
    );

    if (!frameObject) return;

    // 存储上传的图片信息
    (frameObject as any).uploadedImage = {
      id: imageId,
      url: url,
      file: file
    };

    // 加载图片并显示在画布上
    fabric.Image.fromURL(url, (img: any) => {
      if (!img) return;

      const rect = frameObject as fabric.Rect;
      const frameWidth = (rect.width || 200) * (rect.scaleX || 1);
      const frameHeight = (rect.height || 200) * (rect.scaleY || 1);

      // 调整图片大小以适应原画框
      img.scaleToWidth(frameWidth);
      img.scaleToHeight(frameHeight);

      // 设置图片位置与原画框一致
      img.set({
        left: rect.left,
        top: rect.top,
        selectable: false,
        evented: false,
        opacity: 0.7  // 半透明显示，表示这是预览
      });

      // 将图片关联到原画框
      (frameObject as any).uploadedImageObject = img;

      // 添加图片到画布
      canvas.add(img);
      
      // 确保原画框在图片上方
      canvas.bringToFront(frameObject);
      
      // 更新原画框样式，添加视觉标识
      rect.set({
        stroke: '#4CAF50',
        strokeWidth: 3,
        strokeDashArray: [5, 5]  // 虚线边框表示已上传图片
      });

      // 添加图片图标标识
      addImageIndicator(frameObject);

      canvas.renderAll();
    }, { crossOrigin: 'anonymous' });

    // 更新选中对象以刷新属性面板
    setSelectedObject(frameObject);
  };

  const handleImageRemove = (frameId: string) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    
    // 找到对应的原画框对象
    const frameObject = objects.find(obj => 
      obj.type === 'rect' && 
      (obj as any).elementType === 'imageframe' && 
      (obj as any).frameId === frameId
    );

    if (!frameObject) return;

    // 移除关联的图片对象
    const imageObject = (frameObject as any).uploadedImageObject;
    if (imageObject) {
      canvas.remove(imageObject);
      (frameObject as any).uploadedImageObject = undefined;
    }

    // 移除图片图标标识
    const indicator = (frameObject as any).imageIndicator;
    if (indicator) {
      canvas.remove(indicator);
      (frameObject as any).imageIndicator = undefined;
    }

    // 清除上传的图片信息
    (frameObject as any).uploadedImage = undefined;

    // 恢复原画框样式
    const rect = frameObject as fabric.Rect;
    rect.set({
      stroke: '#000000',
      strokeWidth: 2,
      strokeDashArray: null
    });

    canvas.renderAll();

    // 更新选中对象以刷新属性面板
    setSelectedObject(frameObject);
  };

  // 添加图片上传标识图标
  const addImageIndicator = (frameObject: fabric.Object) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const rect = frameObject as fabric.Rect;

    // 移除旧的标识（如果存在）
    const oldIndicator = (frameObject as any).imageIndicator;
    if (oldIndicator) {
      canvas.remove(oldIndicator);
    }

    // 创建一个小圆圈作为标识
    const indicator = new fabric.Circle({
      radius: 12,
      fill: '#4CAF50',
      left: (rect.left || 0) + 10,
      top: (rect.top || 0) + 10,
      selectable: false,
      evented: false
    });

    // 添加图片图标文本
    const icon = new fabric.Text('📷', {
      fontSize: 16,
      left: (rect.left || 0) + 7,
      top: (rect.top || 0) + 5,
      selectable: false,
      evented: false
    });

    const group = new fabric.Group([indicator, icon], {
      selectable: false,
      evented: false
    });

    (frameObject as any).imageIndicator = group;
    canvas.add(group);
    canvas.bringToFront(group);
  };

  const handleContinueToGeneration = () => {
    if (!fabricCanvasRef.current) return;

    const layout = exportLayout(fabricCanvasRef.current, config);
    
    if (layout.elements.length === 0) {
      alert('请至少添加一个元素后再继续生成');
      return;
    }

    // 导出画布为 base64 图像
    const layoutImage = exportCanvasAsImage(fabricCanvasRef.current);
    
    // 将 layoutImage 添加到 LayoutDraft 对象中
    layout.layoutImage = layoutImage;

    if (onExportLayout) {
      onExportLayout(layout);
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <ElementToolbar
        onAddTextBox={handleAddTextBox}
        onAddImageFrame={handleAddImageFrame}
        onDeleteElement={handleDeleteElement}
        hasSelection={hasSelection}
      />

      <div className="flex gap-4">
        {/* 画布配置面板 */}
        <div className="bg-white p-4 rounded-lg shadow-md w-64">
          <h3 className="text-lg font-semibold mb-4">画布配置</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                画布尺寸
              </label>
              <div className="space-y-2">
                {PRESET_SIZES.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetChange(preset)}
                    className={`w-full px-3 py-2 text-sm rounded-md border transition-colors ${
                      selectedPreset.label === preset.label
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                圆角半径 (px)
              </label>
              <input
                type="number"
                value={config.cornerRadius}
                onChange={(e) => handleConfigChange('cornerRadius', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="100"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleContinueToGeneration}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors font-medium"
              >
                继续生成
              </button>
            </div>
          </div>
        </div>

        {/* 画布区域 */}
        <div className="flex-1 bg-gray-50 p-4 rounded-lg shadow-md overflow-auto">
          <div className="inline-block border-2 border-gray-300" style={{
            borderRadius: `${config.cornerRadius}px`
          }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* 属性面板 */}
        <PropertyPanel
          selectedObject={selectedObject}
          onUpdate={handlePropertyUpdate}
          onImageUpload={handleImageUpload}
          onImageRemove={handleImageRemove}
        />
      </div>
    </div>
  );
};

export default CanvasEditor;
