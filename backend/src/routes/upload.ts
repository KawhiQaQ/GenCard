import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { FileUploadError, asyncHandler } from '../middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const imageId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${imageId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1, // 一次只允许上传一个文件
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new FileUploadError('不支持的文件格式。仅支持 JPG、PNG 和 WEBP 格式。'));
    }
  }
});

// POST /api/upload - Upload image
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new FileUploadError('没有上传文件');
  }

  const imageId = path.parse(req.file.filename).name;
  const ext = path.extname(req.file.filename);
  const url = `/uploads/${req.file.filename}`;

  console.log('File uploaded successfully:', {
    imageId: `${imageId}${ext}`,
    size: req.file.size,
    mimetype: req.file.mimetype
  });

  res.json({
    success: true,
    imageId: `${imageId}${ext}`,
    url
  });
}));

export default router;
