/**
 * Generation Mode Manager
 * 
 * Manages switching between DALL-E and Qwen-Image generation modes
 * for smooth migration and backward compatibility
 */

export type GenerationMode = 'dalle' | 'qwen';

/**
 * Get the current generation mode from environment
 */
export function getGenerationMode(): GenerationMode {
  const mode = process.env.GENERATION_MODE?.toLowerCase();
  
  if (mode === 'dalle' || mode === 'qwen') {
    return mode;
  }
  
  // Default to qwen (new mode)
  return 'qwen';
}

/**
 * Check if DALL-E mode is enabled
 */
export function isDallEMode(): boolean {
  return getGenerationMode() === 'dalle';
}

/**
 * Check if Qwen mode is enabled
 */
export function isQwenMode(): boolean {
  return getGenerationMode() === 'qwen';
}


/**
 * Validate that the required API keys are configured for the current mode
 */
export function validateModeConfiguration(): { valid: boolean; error?: string; mode: GenerationMode } {
  const mode = getGenerationMode();
  
  if (mode === 'dalle') {
    // Check OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || openaiKey.trim() === '' || openaiKey === 'your-openai-api-key-here') {
      return {
        valid: false,
        error: 'OPENAI_API_KEY not configured for DALL-E mode',
        mode
      };
    }
  } else if (mode === 'qwen') {
    // Check DashScope API key
    const dashscopeKey = process.env.DASHSCOPE_API_KEY;
    if (!dashscopeKey || dashscopeKey.trim() === '' || dashscopeKey === 'your-dashscope-api-key-here') {
      return {
        valid: false,
        error: 'DASHSCOPE_API_KEY not configured for Qwen mode',
        mode
      };
    }
  }
  
  return { valid: true, mode };
}


/**
 * Get mode information for status endpoints
 */
export function getModeInfo() {
  const mode = getGenerationMode();
  const validation = validateModeConfiguration();
  
  return {
    currentMode: mode,
    available: validation.valid,
    error: validation.error,
    description: mode === 'dalle' 
      ? 'Using DALL-E 3 for image generation (legacy mode)'
      : 'Using ControlNet + Qwen-Image for image generation (recommended)',
    recommendation: mode === 'dalle'
      ? 'Consider migrating to Qwen mode for better layout control and uploaded image support'
      : 'You are using the recommended generation mode'
  };
}

/**
 * Log mode information on startup
 */
export function logModeInfo(): void {
  const info = getModeInfo();
  console.log('=== Generation Mode Configuration ===');
  console.log('Mode:', info.currentMode.toUpperCase());
  console.log('Status:', info.available ? 'Ready' : 'Not Configured');
  console.log('Description:', info.description);
  if (!info.available) {
    console.error('Error:', info.error);
  }
  if (info.currentMode === 'dalle') {
    console.warn('⚠️ ', info.recommendation);
  }
  console.log('=====================================');
}
