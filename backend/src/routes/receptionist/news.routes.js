import { Router } from 'express'
import { newsUpload, getFileUrl } from '../../utils/cloudinary.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import { ok, fail } from '../../utils/response.js'
import {
  create,
  detailForReceptionist,
  listForReceptionist,
  updateForReceptionist,
  getNewsHistory
} from '../../controllers/admin/news.controller.js'

const router = Router()

router.use(verifyToken, requireRole('receptionist', 'admin'))

router.post('/upload', newsUpload.single('image'), (req, res) => {
  try {
    if (!req.file) return fail(res, 400, 'Không tìm thấy file ảnh')
    return ok(res, { url: getFileUrl(req.file) }, 'Tải ảnh tin tức thành công')
  } catch (error) {
    return fail(res, 500, error.message)
  }
})

router.get('/', listForReceptionist)
router.post('/', create)
router.get('/:id', detailForReceptionist)
router.put('/:id', updateForReceptionist)
router.get('/:id/history', getNewsHistory)

export default router
