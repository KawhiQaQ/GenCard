/**
 * Request Format Converter
 * 
 * Converts legacy request formats to the new PromptInput-based format
 * for backward compatibility during migration from DALL-E to Qwen-Image
 */

import { GenerationRequest, PromptInput } from '../types/index.js';

/**
 * Legacy request format (DALL-E based)
 */
interface LegacyGenerationRequest {
  layout: any;
  prompt: string;
  preserveBorders?: boolean;
  uploadedImages?: Array<{
    frameId: string;
    imageUrl: string;
  }>;
}

/**
 * Conversion result with metadata
 */
interface ConversionResult {
  request: GenerationRequest;
  wasConverted: boolean;
  originalFormat: 'legacy' | 'new';
  conversionNotes?: string[];
}

/**
 * Detect if a request is in legacy format
 */
export function isLegacyFormat(request: any): boolean {
  // Legacy format has 'prompt' field instead of 'promptInput'
  return 'prompt' in request && !('promptInput' in request);
}

/**
 * Convert legacy request format to new format
 */
export function convertLegacyRequest(legacyRequest: LegacyGenerationRequest): ConversionResult {
  const notes: string[] = [];
  
  // Extract content and style from the single prompt
  // In legacy format, the entire prompt is treated as style prompt
  const promptInput: PromptInput = {
    contentPrompt: null,
    stylePrompt: legacyRequest.prompt || ''
  };
  
  notes.push('Converted single prompt to stylePrompt');
  
  // Handle uploaded images
  if (legacyRequest.uploadedImages && legacyRequest.uploadedImages.length > 0) {
    notes.push(`Found ${legacyRequest.uploadedImages.length} uploaded images in legacy format`);
    
    // In the new format, uploaded images are stored directly in the layout elements
    // The legacy format stores them separately, so we need to merge them
    for (const uploadedImage of legacyRequest.uploadedImages) {
      const element = legacyRequest.layout.elements.find(
        (e: any) => e.id === uploadedImage.frameId && e.type === 'imageframe'
      );
      
      if (element && !element.uploadedImage) {
        // Extract image ID from URL (assuming format: /uploads/{id})
        const urlParts = uploadedImage.imageUrl.split('/');
        const imageId = urlParts[urlParts.length - 1];
        
        element.uploadedImage = {
          id: imageId,
          url: uploadedImage.imageUrl
        };
        
        notes.push(`Merged uploaded image ${imageId} into frame ${uploadedImage.frameId}`);
      }
    }
  }
  
  // Handle preserveBorders (deprecated in new format)
  if ('preserveBorders' in legacyRequest) {
    notes.push('Ignored deprecated preserveBorders field (always true in new format)');
  }
  
  const newRequest: GenerationRequest = {
    layout: legacyRequest.layout,
    promptInput: promptInput
  };
  
  return {
    request: newRequest,
    wasConverted: true,
    originalFormat: 'legacy',
    conversionNotes: notes
  };
}

/**
 * Normalize any request format to the new format
 */
export function normalizeRequest(request: any): ConversionResult {
  if (isLegacyFormat(request)) {
    return convertLegacyRequest(request as LegacyGenerationRequest);
  }
  
  // Already in new format
  return {
    request: request as GenerationRequest,
    wasConverted: false,
    originalFormat: 'new'
  };
}

/**
 * Log conversion details for monitoring
 */
export function logConversion(conversion: ConversionResult, endpoint: string): void {
  if (conversion.wasConverted) {
    console.log('📋 Request Format Conversion:');
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Original Format: ${conversion.originalFormat}`);
    console.log(`   Conversion Notes:`);
    conversion.conversionNotes?.forEach(note => {
      console.log(`     - ${note}`);
    });
  }
}

/**
 * Get conversion statistics for monitoring
 */
interface ConversionStats {
  totalRequests: number;
  legacyRequests: number;
  newRequests: number;
  conversionRate: number;
}

let stats: ConversionStats = {
  totalRequests: 0,
  legacyRequests: 0,
  newRequests: 0,
  conversionRate: 0
};

export function trackConversion(conversion: ConversionResult): void {
  stats.totalRequests++;
  
  if (conversion.originalFormat === 'legacy') {
    stats.legacyRequests++;
  } else {
    stats.newRequests++;
  }
  
  stats.conversionRate = stats.totalRequests > 0 
    ? (stats.legacyRequests / stats.totalRequests) * 100 
    : 0;
}

export function getConversionStats(): ConversionStats {
  return { ...stats };
}

export function resetConversionStats(): void {
  stats = {
    totalRequests: 0,
    legacyRequests: 0,
    newRequests: 0,
    conversionRate: 0
  };
}
