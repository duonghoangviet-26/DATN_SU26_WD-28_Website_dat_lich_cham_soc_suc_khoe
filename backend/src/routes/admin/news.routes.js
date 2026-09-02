import { Router } from 'express'
import { newsUpload, getFileUrl } from '../../utils/cloudinary.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import { ok, fail } from '../../utils/response.js'
import * as news from '../../controllers/admin/news.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.post('/upload', newsUpload.single('image'), (req, res) => {
  try {
    if (!req.file) return fail(res, 400, 'Không tìm thấy file ảnh')
    return ok(res, { url: getFileUrl(req.file) }, 'Tải ảnh tin tức thành công')
  } catch (error) {
    return fail(res, 500, error.message)
  }
})

router.get('/', news.list)
router.get('/:id', news.detail)
router.get('/:id/history', news.getNewsHistory)
router.post('/', news.create)
router.put('/:id', news.update)
router.patch('/:id/toggle', news.toggle)
router.delete('/:id', news.remove)

export default router
