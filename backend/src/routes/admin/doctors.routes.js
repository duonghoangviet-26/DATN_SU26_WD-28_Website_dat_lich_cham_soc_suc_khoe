import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as doctors from '../../controllers/admin/doctors.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',                      doctors.list)
router.get('/:id',                   doctors.getById)
router.patch('/:id/approve',         doctors.approve)
router.patch('/:id/reject',          doctors.reject)
router.patch('/:id/suspend',         doctors.suspend)
router.patch('/:id/assign-room',     doctors.assignRoom)

export default router
