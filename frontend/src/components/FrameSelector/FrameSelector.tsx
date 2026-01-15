/**
 * FrameSelector - 边框选择器组件
 * 
 * 显示6个边框选项（5种风格 + 无边框），允许用户选择装饰边框风格。
 * 支持边框间隙微调功能。
 * 
 * Requirements: 1.2, 1.3, 1.4
 */

import { FramePresetId } from '../../types/frame';
import { FRAME_PRESETS, VALID_PRESET_IDS } from '../../constants/framePresets';

/** 间隙调整范围：-10 到 +10 像素 */
const GAP_ADJUSTMENT_MIN = -10;
const GAP_ADJUSTMENT_MAX = 10;
const GAP_ADJUSTMENT_DEFAULT = 0;

interface FrameSelectorProps {
  /** 当前选中的预设ID */
  selectedPreset: FramePresetId;
  /** 预设变更回调 */
  onPresetChange: (presetId: FramePresetId) => void;
  /** 当前间隙调整值 */
  gapAdjustment?: number;
  /** 间隙调整变更回调 */
  onGapAdjustmentChange?: (adjustment: number) => void;
  /** 是否禁用选择器 */
  disabled?: boolean;
  /** 是否正在加载 */
  loading?: boolean;
}

/**
 * 边框选择器组件
 * 
 * 显示所有可用的边框预设选项，支持预览和选择。
 * 当选择装饰性边框时，显示间隙调整滑块。
 */
function FrameSelector({ 
  selectedPreset, 
  onPresetChange,
  gapAdjustment = GAP_ADJUSTMENT_DEFAULT,
  onGapAdjustmentChange,
  disabled = false,
  loading = false 
}: FrameSelectorProps) {
  // 是否显示间隙调整（仅当选择了装饰性边框时）
  const showGapAdjustment = selectedPreset !== 'none';

  /**
   * 处理间隙调整滑块变化
   */
  const handleGapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    onGapAdjustmentChange?.(value);
  };

  /**
   * 获取间隙调整的描述文本
   */
  const getGapDescription = (value: number): string => {
    if (value < 0) return `向外 ${Math.abs(value)}px`;
    if (value > 0) return `向内 ${value}px`;
    return '默认位置';
  };

  return (
    <div className="frame-selector">
      <h3 className="text-lg font-medium mb-3 text-gray-700">选择边框风格</h3>
      <div className="grid grid-cols-3 gap-3">
        {VALID_PRESET_IDS.map((presetId) => {
          const preset = FRAME_PRESETS[presetId];
          const isSelected = selectedPreset === presetId;
          const isNone = presetId === 'none';
          
          return (
            <button
              key={presetId}
              onClick={() => onPresetChange(presetId)}
              disabled={disabled || loading}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
                ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={preset.description}
            >
              {/* 预览区域 */}
              <div 
                className={`
                  w-full aspect-square rounded-md mb-2 flex items-center justify-center
                  ${isNone ? 'bg-gray-100 border border-dashed border-gray-300' : ''}
                `}
                style={!isNone ? {
                  background: `linear-gradient(135deg, ${preset.colorScheme.secondary} 0%, ${preset.colorScheme.primary} 50%, ${preset.colorScheme.accent} 100%)`,
                  border: `2px solid ${preset.colorScheme.primary}`,
                } : undefined}
              >
                {isNone && (
                  <span className="text-gray-400 text-2xl">∅</span>
                )}
              </div>
              
              {/* 预设名称 */}
              <div className="text-center">
                <span className={`
                  text-sm font-medium
                  ${isSelected ? 'text-blue-700' : 'text-gray-700'}
                `}>
                  {preset.name}
                </span>
              </div>
              
              {/* 选中指示器 */}
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* 当前选中预设的描述 */}
      <p className="mt-3 text-sm text-gray-500 text-center">
        {FRAME_PRESETS[selectedPreset].description}
      </p>

      {/* 间隙调整滑块 - 仅当选择装饰性边框时显示 */}
      {showGapAdjustment && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">
              边框间隙调整
            </label>
            <span className="text-sm text-blue-600 font-medium">
              {getGapDescription(gapAdjustment)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">外</span>
            <input
              type="range"
              min={GAP_ADJUSTMENT_MIN}
              max={GAP_ADJUSTMENT_MAX}
              value={gapAdjustment}
              onChange={handleGapChange}
              disabled={disabled || loading}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-xs text-gray-500">内</span>
          </div>
          <p className="mt-1 text-xs text-gray-400 text-center">
            负值使边框向外移动，正值使边框向内移动
          </p>
        </div>
      )}
      
      {/* 加载状态提示 */}
      {loading && (
        <div className="mt-2 text-sm text-blue-500 text-center flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          正在应用边框...
        </div>
      )}
    </div>
  );
}

export default FrameSelector;
