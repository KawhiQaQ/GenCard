import React, { useEffect, useState } from 'react';
import { fabric } from 'fabric';
import { ImageFrameUpload } from '../ImageFrameUpload';

interface PropertyPanelProps {
  selectedObject: fabric.Object | null;
  onUpdate: () => void;
  onImageUpload?: (frameId: string, file: File, imageId: string, url: string) => Promise<void>;
  onImageRemove?: (frameId: string) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ 
  selectedObject, 
  onUpdate,
  onImageUpload,
  onImageRemove
}) => {
  const [properties, setProperties] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    text: '',
    fontSize: 20
  });

  useEffect(() => {
    if (!selectedObject) return;

    const isTextbox = selectedObject.type === 'textbox';
    const textbox = selectedObject as fabric.Textbox;

    setProperties({
      left: Math.round(selectedObject.left || 0),
      top: Math.round(selectedObject.top || 0),
      width: Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1)),
      height: Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1)),
      text: isTextbox ? textbox.text || '' : '',
      fontSize: isTextbox ? textbox.fontSize || 20 : 20
    });
  }, [selectedObject]);

  const handlePropertyChange = (field: string, value: string | number) => {
    if (!selectedObject) return;

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    switch (field) {
      case 'left':
        selectedObject.set('left', numValue);
        break;
      case 'top':
        selectedObject.set('top', numValue);
        break;
      case 'width':
        selectedObject.set('width', numValue / (selectedObject.scaleX || 1));
        break;
      case 'height':
        selectedObject.set('height', numValue / (selectedObject.scaleY || 1));
        break;
      case 'text':
        if (selectedObject.type === 'textbox') {
          (selectedObject as fabric.Textbox).set('text', value as string);
        }
        break;
      case 'fontSize':
        if (selectedObject.type === 'textbox') {
          (selectedObject as fabric.Textbox).set('fontSize', numValue);
        }
        break;
    }

    selectedObject.setCoords();
    onUpdate();
  };

  if (!selectedObject) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md w-64">
        <h3 className="text-lg font-semibold mb-4">属性面板</h3>
        <p className="text-gray-500 text-sm">请选择一个元素</p>
      </div>
    );
  }

  const isTextbox = selectedObject.type === 'textbox';
  const isImageFrame = selectedObject.type === 'rect' && (selectedObject as any).elementType === 'imageframe';
  
  // 获取原画框的上传图片信息
  const uploadedImage = isImageFrame ? (selectedObject as any).uploadedImage : undefined;
  const frameId = isImageFrame ? (selectedObject as any).frameId || `frame-${Date.now()}` : undefined;

  return (
    <div className="bg-white p-4 rounded-lg shadow-md w-64">
      <h3 className="text-lg font-semibold mb-4">属性面板</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            X 位置
          </label>
          <input
            type="number"
            value={properties.left}
            onChange={(e) => handlePropertyChange('left', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Y 位置
          </label>
          <input
            type="number"
            value={properties.top}
            onChange={(e) => handlePropertyChange('top', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            宽度
          </label>
          <input
            type="number"
            value={properties.width}
            onChange={(e) => handlePropertyChange('width', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            高度
          </label>
          <input
            type="number"
            value={properties.height}
            onChange={(e) => handlePropertyChange('height', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isTextbox && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                文本内容
              </label>
              <textarea
                value={properties.text}
                onChange={(e) => handlePropertyChange('text', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                字体大小
              </label>
              <input
                type="number"
                value={properties.fontSize}
                onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="8"
                max="200"
              />
            </div>
          </>
        )}

        {isImageFrame && onImageUpload && onImageRemove && (
          <div className="pt-4 border-t border-gray-200">
            <ImageFrameUpload
              frameId={frameId!}
              onUpload={onImageUpload}
              onRemove={onImageRemove}
              uploadedImage={uploadedImage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyPanel;
