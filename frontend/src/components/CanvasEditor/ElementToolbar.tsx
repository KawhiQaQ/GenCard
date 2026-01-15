import React from 'react';

interface ElementToolbarProps {
  onAddTextBox: () => void;
  onAddImageFrame: () => void;
  onDeleteElement: () => void;
  hasSelection: boolean;
}

const ElementToolbar: React.FC<ElementToolbarProps> = ({
  onAddTextBox,
  onAddImageFrame,
  onDeleteElement,
  hasSelection
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-4">
      <h3 className="text-lg font-semibold mb-3">工具栏</h3>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onAddTextBox}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          添加文本框
        </button>
        <button
          onClick={onAddImageFrame}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
        >
          添加原画框
        </button>
        <button
          onClick={onDeleteElement}
          disabled={!hasSelection}
          className={`px-4 py-2 rounded-md transition-colors ${
            hasSelection
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          删除元素
        </button>
      </div>
    </div>
  );
};

export default ElementToolbar;
