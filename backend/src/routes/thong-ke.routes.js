import { Router } from 'express'

import * as thongKe from '../controllers/thong-ke.controller.js'
import { requireRole, verifyToken } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/doanh-thu-theo-ngay', thongKe.doanhThuTheoNgay)
router.get('/lich-hen-theo-trang-thai', thongKe.lichHenTheoTrangThai)
router.get('/doanh-thu-theo-bac-si', thongKe.doanhThuTheoBacSi)
router.get('/benh-nhan-moi-theo-thang', thongKe.benhNhanMoiTheoThang)
router.get('/dich-vu-pho-bien', thongKe.dichVuPhoBien)

export default router
