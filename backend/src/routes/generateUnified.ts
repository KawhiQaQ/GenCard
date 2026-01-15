/**
 * Unified Generation Router
 * 
 * Automatically routes to DALL-E or Qwen generation based on GENERATION_MODE
 * This provides a smooth migration path between the two systems
 */

import express from 'express';
import { getGenerationMode, validateModeConfiguration, getModeInfo } from '../utils/generationModeManager.js';
import { AIServiceError, asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /api/generate/unified
 * Generate card using the configured generation mode
 */
router.post('/', asyncHandler(async (req, res, next) => {
  const mode = getGenerationMode();
  const validation = validateModeConfiguration();
  
  if (!validation.valid) {
    throw new AIServiceError(
      `Generation service not configured: ${validation.error}`,
      503
    );
  }
  
  console.log(`🔀 Routing to ${mode.toUpperCase()} generation mode`);
  
  // Import the appropriate handler dynamically
  if (mode === 'dalle') {
    const { default: generateRouter } = await import('./generate.js');
    // Use the router's stack to find the POST handler
    const postHandler = generateRouter.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.post
    );
    if (postHandler && postHandler.route) {
      return postHandler.route.stack[0].handle(req, res, next);
    }
  } else {
    const { default: generateV2Router } = await import('./generateV2.js');
    // Use the router's stack to find the POST handler
    const postHandler = generateV2Router.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.post
    );
    if (postHandler && postHandler.route) {
      return postHandler.route.stack[0].handle(req, res, next);
    }
  }
  
  throw new AIServiceError('Failed to route request to generation handler', 500);
}));


/**
 * GET /api/generate/unified/status
 * Check unified generation service status
 */
router.get('/status', (_req, res) => {
  const info = getModeInfo();
  
  res.json({
    ...info,
    endpoints: {
      unified: '/api/generate/unified (auto-routes based on mode)',
      dalle: '/api/generate (legacy DALL-E)',
      qwen: '/api/v2/generate (ControlNet + Qwen)'
    }
  });
});

export default router;
