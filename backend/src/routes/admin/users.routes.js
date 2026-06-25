import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as users from '../../controllers/admin/users.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',                    users.list)
router.get('/:id',                 users.getById)
router.patch('/:id/toggle-lock',   users.toggleLock)

export default router
