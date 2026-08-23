import { Router } from 'express'

import * as controller from '../../controllers/receptionist/doctor-leaves.controller.js'

const router = Router()

router.get('/pending', controller.listPendingLeaves)
// Path cụ thể hơn ('huy-bao-nghi/preview' vs 'approve'/'reject') nên không có route nào
// là tiền tố của route khác — thứ tự đăng ký không ảnh hưởng tới khớp path ở đây.
router.get('/:id/huy-bao-nghi/preview', controller.previewHuyBaoNghi)
router.patch('/:id/huy-bao-nghi', controller.huyBaoNghiHandler)
router.patch('/:id/approve', controller.approveLeave)
router.patch('/:id/reject', controller.rejectLeave)

export default router
