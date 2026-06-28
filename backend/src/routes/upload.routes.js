import { Router } from 'express'
import { upload } from '../utils/cloudinary.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'
import { ok, fail } from '../utils/response.js'

const router = Router()

// Bắt buộc đăng nhập với quyền admin (hoặc doctor nếu cần thiết sau này)
router.use(verifyToken, requireRole('admin'))

router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'Không tìm thấy file ảnh')
    }
    // req.file.path chứa URL ảnh trả về từ Cloudinary
    return ok(res, { url: req.file.path }, 'Tải ảnh thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

export default router
