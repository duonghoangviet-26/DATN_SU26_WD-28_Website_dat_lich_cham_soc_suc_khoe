import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as templates from '../../controllers/admin/schedule-templates.controller.js'

// Mau dang ky ca lam viec cua bac si (rule muc 3 + 10.B).
// Day la NGUON de scheduleGenerator biet ca nao co nguoi truc — khong con auto full-day.
const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/grid', templates.grid)
router.get('/', templates.list)
router.post('/bulk', templates.bulkCreate)
router.post('/', templates.create)
router.put('/:id', templates.update)
router.delete('/:id', templates.remove)

export default router
