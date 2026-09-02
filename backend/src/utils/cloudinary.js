import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

let storage;
let newsStorage;

const isCloudinaryConfigured = !!process.env.CLOUDINARY_CLOUD_NAME;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'vitafamily', // Tên thư mục trên Cloudinary
      allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }] // Tối ưu kích thước
    },
  })

  newsStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'vitafamily/news',
      allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
      transformation: [{ width: 1920, crop: 'limit' }]
    },
  })
} else {
  // Fallback to local storage if Cloudinary is not configured
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  
  const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
  })
  
  storage = diskStorage
  newsStorage = diskStorage
}

const upload = multer({ storage: storage })
const newsUpload = multer({ storage: newsStorage })

// Helper function to get the final URL
function getFileUrl(file) {
  if (isCloudinaryConfigured && file.path && file.path.startsWith('http')) {
    return file.path;
  }
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${backendUrl}/uploads/${file.filename}`;
}

export { cloudinary, upload, newsUpload, getFileUrl }
