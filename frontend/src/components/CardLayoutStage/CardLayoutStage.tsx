import React, { useState, useMemo } from 'react';
import { 
  ArtworkData, 
  CardGenerationRequest, 
  LayoutVariant,
  ContentBoxShape,
  TextureType,
  BlurIntensity,
  GlowIntensity,
  ScalePreset
} from '../../types/canvas';
import { 
  PREMIUM_TEXTBOX_COLORS,
  getLayoutConfigByVariant,
  combineLayoutVariant,
  PremiumColorId
} from '../../constants/cardLayout';
import { getTextureOptions, DEFAULT_TEXTURE_TYPE } from '../../constants/textureConfig';
import { getBlurOptions, DEFAULT_BLUR_INTENSITY } from '../../constants/blurConfig';
import { GLOW_INTENSITY_OPTIONS, generateGlowCss, getGlowConfig } from '../../constants/glowConfig';
import { getScalePresetOptions, DEFAULT_SCALE_PRESET, applyScalePreset } from '../../constants/scaleConfig';

/**
 * CardLayoutStage 组件的 Props 接口
 * 第二阶段：卡牌布局和背景生成
 */
export interface CardLayoutStageProps {
  /** 第一阶段的原画数据 */
  artwork: ArtworkData;
  /** 生成卡牌的回调函数 */
  onGenerate: (request: CardGenerationRequest) => void;
  /** 返回上一阶段的回调函数 */
  onBack: () => void;
  /** 是否正在生成中 */
  isGenerating: boolean;
  /** 错误信息 */
  error?: string | null;
}

/**
 * 文本框状态接口
 */
interface TextBoxState {
  title: string;
  content1: string;
  content2: string;
  content3: string;
  content4: string;
}

// 内容框形状选项（2选1）
const CONTENT_BOX_SHAPE_OPTIONS: Array<{
  id: ContentBoxShape;
  name: string;
  description: string;
}> = [
  { id: 'square', name: '方形', description: '标准方形内容框' },
  { id: 'flat', name: '扁平', description: '扁平矮内容框' }
];

/**
 * CardLayoutStage 组件
 * 第二阶段：支持4选1布局切换、视觉效果控制、5个文本框编辑
 */
export const CardLayoutStage: React.FC<CardLayoutStageProps> = ({
  artwork,
  onGenerate,
  onBack,
  isGenerating,
  error
}) => {
  // 内容框形状状态（默认方形）- 与 artwork.layoutMode 组合得到 layoutVariant
  const [contentBoxShape, setContentBoxShape] = useState<ContentBoxShape>('square');
  
  // 文本框底色状态（默认黑曜石）
  const [textBoxColorId, setTextBoxColorId] = useState<PremiumColorId>('obsidian');
  
  // 5个文本框状态（1标题 + 4内容）
  const [textBoxes, setTextBoxes] = useState<TextBoxState>({
    title: '',
    content1: '',
    content2: '',
    content3: '',
    content4: ''
  });
  
  // 背景风格提示词
  const [backgroundPrompt, setBackgroundPrompt] = useState('');

  // 视觉效果状态
  const [textureType, setTextureType] = useState<TextureType>(DEFAULT_TEXTURE_TYPE);
  const [blurIntensity, setBlurIntensity] = useState<BlurIntensity>(DEFAULT_BLUR_INTENSITY);
  const [glowIntensity, setGlowIntensity] = useState<GlowIntensity>('medium');
  const [scalePreset, setScalePreset] = useState<ScalePreset>(DEFAULT_SCALE_PRESET);

  // 组合 layoutMode 和 contentBoxShape 得到 layoutVariant
  const layoutVariant: LayoutVariant = useMemo(() => {
    return combineLayoutVariant(artwork.layoutMode, contentBoxShape);
  }, [artwork.layoutMode, contentBoxShape]);

  // 根据布局变体获取当前布局配置（应用缩放）
  const currentLayout = useMemo(() => {
    const baseLayout = getLayoutConfigByVariant(layoutVariant);
    return applyScalePreset(baseLayout, scalePreset);
  }, [layoutVariant, scalePreset]);
  
  // 获取当前选中的底色配置
  const currentColor = useMemo(() => 
    PREMIUM_TEXTBOX_COLORS.find(c => c.id === textBoxColorId) || PREMIUM_TEXTBOX_COLORS[0],
    [textBoxColorId]
  );

  // 获取外发光CSS样式
  const glowStyle = useMemo(() => {
    const config = getGlowConfig(glowIntensity);
    return generateGlowCss(config);
  }, [glowIntensity]);

  // 文本框标签映射
  const textBoxLabels: Record<keyof TextBoxState, string> = {
    title: '标题',
    content1: '内容1',
    content2: '内容2',
    content3: '内容3',
    content4: '内容4'
  };

  // 文本框占位符
  const textBoxPlaceholders: Record<keyof TextBoxState, string> = {
    title: '输入卡牌标题...',
    content1: '输入第一段内容...',
    content2: '输入第二段内容...',
    content3: '输入第三段内容...',
    content4: '输入第四段内容...'
  };

  /**
   * 更新文本框内容
   */
  const handleTextChange = (id: keyof TextBoxState, text: string) => {
    setTextBoxes(prev => ({ ...prev, [id]: text }));
  };

  /**
   * 处理生成请求
   */
  const handleGenerate = () => {
    const request: CardGenerationRequest = {
      artworkUrl: artwork.imageUrl,
      layoutMode: artwork.layoutMode,
      layoutVariant,
      textBoxes: [
        { id: 'title', text: textBoxes.title },
        { id: 'content1', text: textBoxes.content1 },
        { id: 'content2', text: textBoxes.content2 },
        { id: 'content3', text: textBoxes.content3 },
        { id: 'content4', text: textBoxes.content4 }
      ],
      textBoxColorId,
      backgroundPrompt,
      textureType,
      blurIntensity,
      glowIntensity,
      scalePreset
    };
    onGenerate(request);
  };

  // 计算预览区域的缩放比例
  const previewScale = useMemo(() => {
    const maxWidth = 400;
    const maxHeight = 400;
    const baseLayout = getLayoutConfigByVariant(layoutVariant);
    const scaleX = maxWidth / baseLayout.canvas.width;
    const scaleY = maxHeight / baseLayout.canvas.height;
    return Math.min(scaleX, scaleY);
  }, [layoutVariant]);

  // 获取纹理叠加层样式（用于伪元素或单独的叠加div）
  const getTextureOverlay = (): string | null => {
    if (textureType === 'none') return null;
    
    const texturePatterns: Record<TextureType, string> = {
      'matte-paper': `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E")`,
      'silk': `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)`,
      'ink-wash': `radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(255,255,255,0.03) 0%, transparent 40%)`,
      'none': ''
    };
    
    return texturePatterns[textureType] || null;
  };

  // 获取模糊CSS样式
  const getBlurStyle = (): React.CSSProperties => {
    const blurValues: Record<BlurIntensity, number> = {
      'light': 8,
      'medium': 12,
      'strong': 16
    };
    return {
      backdropFilter: `blur(${blurValues[blurIntensity]}px)`,
      WebkitBackdropFilter: `blur(${blurValues[blurIntensity]}px)`
    };
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">第二步：生成卡牌背景</h2>

        {/* 2选1内容框形状选择器 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            内容框形状
            <span className="ml-2 text-xs text-gray-500">
              (当前布局: {artwork.layoutMode === 'landscape' ? '横版' : '竖版'})
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {CONTENT_BOX_SHAPE_OPTIONS.map(option => {
              const isLandscape = artwork.layoutMode === 'landscape';
              const isFlat = option.id === 'flat';
              
              return (
                <button
                  key={option.id}
                  onClick={() => setContentBoxShape(option.id)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    contentBoxShape === option.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-center">
                    {/* 布局缩略图 */}
                    <div 
                      className={`border-2 border-current rounded mb-2 flex ${
                        isLandscape ? 'w-16 h-12' : 'w-12 h-16'
                      } ${isLandscape ? 'flex-row' : 'flex-col'}`}
                    >
                      {isLandscape ? (
                        <>
                          <div className="w-1/3 border-r border-current bg-gray-200"></div>
                          <div className="flex-1 flex flex-col p-0.5">
                            <div className="h-1/5 border-b border-current"></div>
                            <div className={`flex-1 grid grid-cols-2 gap-0.5 ${isFlat ? 'py-1' : ''}`}>
                              <div className={`border border-current ${isFlat ? 'h-2/3' : ''}`}></div>
                              <div className={`border border-current ${isFlat ? 'h-2/3' : ''}`}></div>
                              <div className={`border border-current ${isFlat ? 'h-2/3' : ''}`}></div>
                              <div className={`border border-current ${isFlat ? 'h-2/3' : ''}`}></div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="h-1/2 border-b border-current bg-gray-200"></div>
                          <div className="h-1/6 border-b border-current"></div>
                          <div className={`flex-1 grid grid-cols-2 gap-0.5 p-0.5 ${isFlat ? 'py-1' : ''}`}>
                            <div className={`border border-current ${isFlat ? 'h-1/2' : ''}`}></div>
                            <div className={`border border-current ${isFlat ? 'h-1/2' : ''}`}></div>
                            <div className={`border border-current ${isFlat ? 'h-1/2' : ''}`}></div>
                            <div className={`border border-current ${isFlat ? 'h-1/2' : ''}`}></div>
                          </div>
                        </>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      contentBoxShape === option.id ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {option.name}
                    </span>
                    <span className="text-xs text-gray-400">{option.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 视觉效果控制面板 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            视觉效果
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 纹理选择器 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">纹理</label>
              <select
                value={textureType}
                onChange={e => setTextureType(e.target.value as TextureType)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getTextureOptions().map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>

            {/* 模糊强度选择器 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">模糊强度</label>
              <select
                value={blurIntensity}
                onChange={e => setBlurIntensity(e.target.value as BlurIntensity)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getBlurOptions().map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name} ({opt.blur}px)</option>
                ))}
              </select>
            </div>

            {/* 外发光强度选择器 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">外发光</label>
              <select
                value={glowIntensity}
                onChange={e => setGlowIntensity(e.target.value as GlowIntensity)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {GLOW_INTENSITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 整体比例选择器 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">整体比例 <span className="text-gray-400">（需要卡牌边框推荐95%及以下）</span></label>
              <select
                value={scalePreset}
                onChange={e => setScalePreset(e.target.value as ScalePreset)}
                disabled={isGenerating}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getScalePresetOptions().map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name} ({Math.round(opt.factor * 100)}%)</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 文本框底色选择器 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            文本框底色
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {PREMIUM_TEXTBOX_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => setTextBoxColorId(color.id)}
                disabled={isGenerating}
                className={`p-3 rounded-lg border-2 transition-all ${
                  textBoxColorId === color.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className="w-full h-8 rounded mb-2"
                  style={{
                    background: `linear-gradient(135deg, ${color.gradient.join(', ')})`
                  }}
                />
                <span className={`text-xs font-medium ${
                  textBoxColorId === color.id ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 上半部分：背景生成 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 左侧：提示词输入 */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                背景风格提示词
              </label>
              <textarea
                value={backgroundPrompt}
                onChange={e => setBackgroundPrompt(e.target.value)}
                placeholder="描述卡牌背景风格，例如：奇幻森林、星空宇宙、古老城堡、神秘魔法阵..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500">
                提示：描述背景的风格、氛围、元素等，AI 将生成与原画协调的背景
              </p>
            </div>

            {/* 原画缩略图预览 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                当前原画
              </label>
              <div 
                className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
                style={{
                  // 根据布局模式调整缩略图尺寸
                  // 横版原画 720x1280 → 缩略图 48x85 (约 w-12 h-20)
                  // 竖版原画 1024x1024 → 缩略图 80x80 (约 w-20 h-20)
                  width: artwork.layoutMode === 'landscape' ? '3rem' : '5rem',
                  height: artwork.layoutMode === 'landscape' ? '5.3rem' : '5rem'
                }}
              >
                <img
                  src={artwork.imageUrl}
                  alt="原画缩略图"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-gray-400">
                {artwork.layoutMode === 'landscape' ? '720×1280' : '1024×1024'}
              </p>
            </div>
          </div>

          {/* 右侧：布局预览区域（应用视觉效果） */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              卡牌布局预览
            </label>
            <div 
              className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-300 mx-auto"
              style={{ 
                width: getLayoutConfigByVariant(layoutVariant).canvas.width * previewScale,
                height: getLayoutConfigByVariant(layoutVariant).canvas.height * previewScale
              }}
            >
              {/* 原画框预览 */}
              <div
                className="absolute bg-gray-600 flex items-center justify-center overflow-hidden"
                style={{
                  left: currentLayout.artworkFrame.x * previewScale,
                  top: currentLayout.artworkFrame.y * previewScale,
                  width: currentLayout.artworkFrame.width * previewScale,
                  height: currentLayout.artworkFrame.height * previewScale,
                  border: '2px solid #C9A962',
                  boxShadow: glowStyle
                }}
              >
                <img
                  src={artwork.imageUrl}
                  alt="原画预览"
                  className="w-full h-full object-cover object-center"
                />
              </div>

              {/* 标题框预览（应用纹理、模糊、发光效果） */}
              <div
                className="absolute flex items-center justify-center text-white text-xs overflow-hidden"
                style={{
                  left: currentLayout.titleBox.x * previewScale,
                  top: currentLayout.titleBox.y * previewScale,
                  width: currentLayout.titleBox.width * previewScale,
                  height: currentLayout.titleBox.height * previewScale,
                  background: `linear-gradient(135deg, ${currentColor.gradient.join(', ')})`,
                  border: '2px solid #8B7355',
                  boxShadow: glowStyle,
                  ...getBlurStyle()
                }}
              >
                {/* 纹理叠加层 */}
                {getTextureOverlay() && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: getTextureOverlay()!,
                      mixBlendMode: 'overlay'
                    }}
                  />
                )}
                <span className="truncate px-1 relative z-10">
                  {textBoxes.title || '标题'}
                </span>
              </div>

              {/* 4个内容框预览 (2x2网格，应用视觉效果) */}
              {currentLayout.contentBoxes.map((box, index) => (
                <div
                  key={box.id}
                  className="absolute flex items-center justify-center text-white text-xs overflow-hidden"
                  style={{
                    left: box.x * previewScale,
                    top: box.y * previewScale,
                    width: box.width * previewScale,
                    height: box.height * previewScale,
                    background: `linear-gradient(135deg, ${currentColor.gradient.join(', ')})`,
                    border: '2px solid #8B7355',
                    boxShadow: glowStyle,
                    ...getBlurStyle()
                  }}
                >
                  {/* 纹理叠加层 */}
                  {getTextureOverlay() && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: getTextureOverlay()!,
                        mixBlendMode: 'overlay'
                      }}
                    />
                  )}
                  <span className="truncate px-1 relative z-10">
                    {textBoxes[`content${index + 1}` as keyof TextBoxState] || `内容${index + 1}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center">
              尺寸：{getLayoutConfigByVariant(layoutVariant).canvas.width} × {getLayoutConfigByVariant(layoutVariant).canvas.height}
              {scalePreset !== 'standard' && ` (缩放: ${Math.round(getScalePresetOptions().find(o => o.id === scalePreset)?.factor || 1) * 100}%)`}
            </p>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">文本框内容（1标题 + 4内容）</span>
          </div>
        </div>

        {/* 下半部分：文本框编辑 */}
        <div className="space-y-4 mb-8">
          {/* 标题框单独一行 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {textBoxLabels.title}
            </label>
            <textarea
              value={textBoxes.title}
              onChange={e => handleTextChange('title', e.target.value)}
              placeholder={textBoxPlaceholders.title}
              className="w-full h-16 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              disabled={isGenerating}
            />
          </div>

          {/* 4个内容框 2x2 排列 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['content1', 'content2', 'content3', 'content4'] as const).map(id => (
              <div key={id} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {textBoxLabels[id]}
                </label>
                <textarea
                  value={textBoxes[id]}
                  onChange={e => handleTextChange(id, e.target.value)}
                  placeholder={textBoxPlaceholders[id]}
                  className="w-full h-20 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  disabled={isGenerating}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-4">
          <button
            onClick={onBack}
            disabled={isGenerating}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
          >
            返回上一步
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !backgroundPrompt.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                生成中...
              </span>
            ) : '生成卡牌'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardLayoutStage;
