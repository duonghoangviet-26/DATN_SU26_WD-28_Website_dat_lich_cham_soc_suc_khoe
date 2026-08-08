import express from 'express'
import {
  createPhanHoi,
  getPhanHoiList,
  markAsRead,
  deletePhanHoi
} from '../controllers/phanHoiController.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = express.Router()

// Client có thể tạo phản hồi mà không cần đăng nhập
router.post('/', createPhanHoi)

// Các route dành cho Admin
router.get('/', verifyToken, requireRole('admin'), getPhanHoiList)
router.put('/:id/read', verifyToken, requireRole('admin'), markAsRead)
router.delete('/:id', verifyToken, requireRole('admin'), deletePhanHoi)

export default router
