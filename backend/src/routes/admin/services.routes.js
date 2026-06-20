import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as services from '../../controllers/admin/services.controller.js'

// ============================================================
// C4 — Route dịch vụ (Admin)
// Base: /api/admin/services  (mount trong routes/admin/index.js)
// Tất cả route yêu cầu: đăng nhập + role admin
// ============================================================

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/',          services.list)      // GET  /api/admin/services
router.get('/:id',       services.getById)   // GET  /api/admin/services/:id
router.post('/',         services.create)    // POST /api/admin/services
router.put('/:id',       services.update)    // PUT  /api/admin/services/:id
router.patch('/:id/toggle', services.toggle) // PATCH /api/admin/services/:id/toggle

export default router
