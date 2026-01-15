import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import uploadRouter from './routes/upload.js';
import generateRouter from './routes/generate.js';
import generateV2Router from './routes/generateV2.js';
import generateUnifiedRouter from './routes/generateUnified.js';
import downloadRouter from './routes/download.js';
import artworkRouter from './routes/artwork.js';
import cardRouter from './routes/card.js';
import frameRouter from './routes/frame.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logModeInfo } from './utils/generationModeManager.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create necessary directories
const uploadsDir = path.join(__dirname, '..', 'uploads');
const generatedDir = path.join(__dirname, '..', 'generated');
const sketchesDir = path.join(__dirname, '..', 'sketches');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
  console.log('Created generated directory:', generatedDir);
}

if (!fs.existsSync(sketchesDir)) {
  fs.mkdirSync(sketchesDir, { recursive: true });
  console.log('Created sketches directory:', sketchesDir);
}

// Serve static files
app.use('/uploads', express.static(uploadsDir));
app.use('/generated', express.static(generatedDir));
app.use('/sketches', express.static(sketchesDir));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDistPath));
  console.log('Serving frontend from:', frontendDistPath);
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI Card Generator API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/upload', uploadRouter);
app.use('/api/generate/unified', generateUnifiedRouter);
app.use('/api/generate', generateRouter);
app.use('/api/v2/generate', generateV2Router);
app.use('/api/download', downloadRouter);
app.use('/api/artwork', artworkRouter);
app.use('/api/card', cardRouter);
app.use('/api/card', frameRouter);  // Frame routes mounted under /api/card

// Serve frontend index.html for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
    res.sendFile(frontendDistPath);
  });
}

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Generated directory: ${generatedDir}`);
  console.log(`Sketches directory: ${sketchesDir}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  
  // Log generation mode configuration
  logModeInfo();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('=== Unhandled Rejection ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('===========================');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('=== Uncaught Exception ===');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('==========================');
  // In production, you might want to exit the process
  // process.exit(1);
});
