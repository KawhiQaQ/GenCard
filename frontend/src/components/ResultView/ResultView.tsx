/**
 * ResultView - 结果展示组件
 * 
 * 显示生成的卡牌图片，支持边框选择和下载功能。
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import { useState } from 'react';
import { GenerationResponse, LayoutVariant } from '../../types/canvas';
import { FramePresetId } from '../../types/frame';
import { applyFrame } from '../../services/api';
import FrameSelector from '../FrameSelector/FrameSelector';
import DownloadButton from './DownloadButton.tsx';

interface ResultViewProps {
  result: GenerationResponse;
  onBackToEditing: () => void;
  onBackToGeneration: () => void;
  /** 布局变体（用于边框渲染） */
  layoutVariant?: LayoutVariant;
}

function ResultView({ 
  result, 
  onBackToEditing, 
  onBackToGeneration,
  layoutVariant = 'landscape-square'
}: ResultViewProps) {
  // 边框相关状态
  const [selectedFrame, setSelectedFrame] = useState<FramePresetId>('none');
  const [gapAdjustment, setGapAdjustment] = useState<number>(0);
  const [isApplyingFrame, setIsApplyingFrame] = useState(false);
  const [framedImageUrl, setFramedImageUrl] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);

  // 当前显示的图片URL（带边框或原图）
  const displayImageUrl = framedImageUrl || result.imageUrl;

  /**
   * 应用边框的核心函数
   */
  const applyFrameWithOptions = async (presetId: FramePresetId, adjustment: number) => {
    // 如果选择"无边框"，恢复原图
    if (presetId === 'none') {
      setFramedImageUrl(null);
      return;
    }

    // 应用边框
    if (!result.imageUrl) return;

    setIsApplyingFrame(true);
    setFrameError(null);
    
    try {
      // 间隙调整转换为 insetOffset：adjustment 正值表示向内，负值表示向外
      // 默认 insetOffset 约为 10，调整范围 -10 到 +10
      const response = await applyFrame(result.imageUrl, presetId, layoutVariant, {
        insetOffset: 10 + adjustment, // 基础值 10 + 调整值
      });
      
      if (response.success && response.imageUrl) {
        setFramedImageUrl(response.imageUrl);
      } else {
        setFrameError(response.error || '应用边框失败');
        // 失败时恢复到无边框状态
        setSelectedFrame('none');
        setFramedImageUrl(null);
      }
    } catch (err) {
      console.error('Apply frame error:', err);
      setFrameError(err instanceof Error ? err.message : '应用边框时发生错误');
      setSelectedFrame('none');
      setFramedImageUrl(null);
    } finally {
      setIsApplyingFrame(false);
    }
  };

  /**
   * 处理边框预设变更
   */
  const handleFrameChange = async (presetId: FramePresetId) => {
    setSelectedFrame(presetId);
    setFrameError(null);
    
    // 切换边框时重置间隙调整
    if (presetId === 'none') {
      setGapAdjustment(0);
      setFramedImageUrl(null);
    } else {
      await applyFrameWithOptions(presetId, gapAdjustment);
    }
  };

  /**
   * 处理间隙调整变更
   */
  const handleGapAdjustmentChange = async (adjustment: number) => {
    setGapAdjustment(adjustment);
    
    // 如果已选择边框，重新应用
    if (selectedFrame !== 'none') {
      await applyFrameWithOptions(selectedFrame, adjustment);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">生成完成</h2>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* 左侧：图片预览 */}
        <div className="flex-1">
          {/* 显示生成的卡牌图片 */}
          {displayImageUrl && (
            <div className="mb-4">
              <img
                src={displayImageUrl}
                alt="Generated Card"
                className={`max-w-full h-auto mx-auto rounded-lg shadow-lg transition-opacity duration-300 ${
                  isApplyingFrame ? 'opacity-50' : 'opacity-100'
                }`}
              />
            </div>
          )}

          {/* 显示生成时间信息 */}
          {result.generationTime && (
            <p className="text-sm text-gray-600 mb-4 text-center">
              生成耗时: {result.generationTime.toFixed(2)} 秒
            </p>
          )}
        </div>

        {/* 右侧：边框选择器 */}
        <div className="lg:w-80">
          <FrameSelector
            selectedPreset={selectedFrame}
            onPresetChange={handleFrameChange}
            gapAdjustment={gapAdjustment}
            onGapAdjustmentChange={handleGapAdjustmentChange}
            disabled={!result.imageUrl}
            loading={isApplyingFrame}
          />
          
          {/* 边框应用错误提示 */}
          {frameError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{frameError}</p>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={onBackToEditing}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
        >
          返回编辑
        </button>
        <button
          onClick={onBackToGeneration}
          className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
        >
          重新生成
        </button>
        {displayImageUrl && (
          <DownloadButton 
            imageUrl={displayImageUrl} 
            filename={framedImageUrl ? 'card-with-frame.png' : 'card.png'}
          />
        )}
      </div>
    </div>
  );
}

export default ResultView;
