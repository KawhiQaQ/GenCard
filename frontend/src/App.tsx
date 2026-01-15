import { useState } from 'react'
import ArtworkStage from './components/ArtworkStage/ArtworkStage'
import CardLayoutStage from './components/CardLayoutStage/CardLayoutStage'
import ResultView from './components/ResultView/ResultView'
import ErrorMessage from './components/ErrorMessage/ErrorMessage'
import { ArtworkData, CardGenerationRequest, GenerationResponse, LayoutVariant } from './types/canvas'
import { generateArtwork, generateCardBackground } from './services/api'

// 新的两阶段流程类型
type AppStage = 'artwork' | 'card-layout' | 'result';

function App() {
  // 当前阶段
  const [stage, setStage] = useState<AppStage>('artwork');
  
  // 原画数据（第一阶段输出）
  const [artwork, setArtwork] = useState<ArtworkData | null>(null);
  
  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 生成结果
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  
  // 当前布局变体（用于边框渲染）
  const [currentLayoutVariant, setCurrentLayoutVariant] = useState<LayoutVariant>('landscape-square');
  
  // 错误和警告
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  /**
   * 处理原画生成（第一阶段）
   */
  const handleGenerateArtwork = async (prompt: string, width?: number, height?: number) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateArtwork({ prompt, width, height });
      
      if (response.success && response.imageUrl) {
        // 根据传入的宽高判断布局模式
        const layoutMode = (width === 1024 && height === 1024) ? 'portrait' : 'landscape';
        setArtwork({
          imageUrl: response.imageUrl,
          isUploaded: false,
          layoutMode: layoutMode
        });
      } else {
        setError(response.error || '原画生成失败，请重试');
      }
    } catch (err) {
      console.error('Artwork generation error:', err);
      setError(err instanceof Error ? err.message : '原画生成过程中发生错误');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 处理原画确认，进入第二阶段
   */
  const handleArtworkReady = (artworkData: ArtworkData) => {
    setArtwork(artworkData);
    setStage('card-layout');
    setError(null);
    setWarning(null);
  };

  /**
   * 处理卡牌背景生成（第二阶段）
   */
  const handleGenerateCard = async (request: CardGenerationRequest) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateCardBackground(request);
      
      if (response.success && response.imageUrl) {
        setGenerationResult({
          success: true,
          imageUrl: response.imageUrl,
          generationTime: response.generationTime
        });
        // 保存布局变体用于边框渲染
        setCurrentLayoutVariant(request.layoutVariant);
        setStage('result');
      } else {
        setError(response.error || '背景生成失败，请重试');
      }
    } catch (err) {
      console.error('Card generation error:', err);
      setError(err instanceof Error ? err.message : '卡牌生成过程中发生错误');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 返回第一阶段（原画阶段）
   */
  const handleBackToArtwork = () => {
    setStage('artwork');
    setError(null);
    setWarning(null);
  };

  /**
   * 返回第二阶段（卡牌布局阶段）
   */
  const handleBackToCardLayout = () => {
    setStage('card-layout');
    setGenerationResult(null);
    setError(null);
    setWarning(null);
  };

  /**
   * 重新开始（从第一阶段开始）
   */
  const handleStartOver = () => {
    setStage('artwork');
    setArtwork(null);
    setGenerationResult(null);
    setError(null);
    setWarning(null);
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleDismissWarning = () => {
    setWarning(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">AI卡牌生成器</h1>
        
        {/* 进度指示器 */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${stage === 'artwork' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stage === 'artwork' ? 'bg-blue-600 text-white' : 
                (stage === 'card-layout' || stage === 'result') ? 'bg-green-500 text-white' : 'bg-gray-300'
              }`}>
                {(stage === 'card-layout' || stage === 'result') ? '✓' : '1'}
              </div>
              <span className="ml-2 text-sm font-medium">准备原画</span>
            </div>
            
            <div className={`w-16 h-0.5 ${(stage === 'card-layout' || stage === 'result') ? 'bg-green-500' : 'bg-gray-300'}`} />
            
            <div className={`flex items-center ${stage === 'card-layout' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stage === 'card-layout' ? 'bg-blue-600 text-white' : 
                stage === 'result' ? 'bg-green-500 text-white' : 'bg-gray-300'
              }`}>
                {stage === 'result' ? '✓' : '2'}
              </div>
              <span className="ml-2 text-sm font-medium">编辑卡牌</span>
            </div>
            
            <div className={`w-16 h-0.5 ${stage === 'result' ? 'bg-green-500' : 'bg-gray-300'}`} />
            
            <div className={`flex items-center ${stage === 'result' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stage === 'result' ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">完成</span>
            </div>
          </div>
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6">
            <ErrorMessage 
              message={error} 
              type="error"
              onDismiss={handleDismissError}
            />
          </div>
        )}

        {/* 警告提示 */}
        {warning && (
          <div className="max-w-2xl mx-auto mb-6">
            <ErrorMessage 
              message={warning} 
              type="warning"
              onDismiss={handleDismissWarning}
            />
          </div>
        )}

        {/* 第一阶段：原画生成/上传 */}
        {stage === 'artwork' && (
          <ArtworkStage
            onArtworkReady={handleArtworkReady}
            isGenerating={isGenerating}
            onGenerateArtwork={handleGenerateArtwork}
            artwork={artwork}
            error={error}
          />
        )}

        {/* 第二阶段：卡牌布局编辑 */}
        {stage === 'card-layout' && artwork && (
          <CardLayoutStage
            artwork={artwork}
            onGenerate={handleGenerateCard}
            onBack={handleBackToArtwork}
            isGenerating={isGenerating}
            error={error}
          />
        )}

        {/* 结果展示阶段 */}
        {stage === 'result' && generationResult && (
          <ResultView
            result={generationResult}
            onBackToEditing={handleStartOver}
            onBackToGeneration={handleBackToCardLayout}
            layoutVariant={currentLayoutVariant}
          />
        )}
      </div>
    </div>
  )
}

export default App
