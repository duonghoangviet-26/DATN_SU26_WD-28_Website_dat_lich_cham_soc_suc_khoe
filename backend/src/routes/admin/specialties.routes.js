import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as specialties from '../../controllers/admin/specialties.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',        specialties.list)
router.get('/:id',     specialties.getById)
router.post('/',       specialties.create)
router.put('/:id',     specialties.update)
router.patch('/:id/toggle', specialties.toggle)

export default router
