import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as reviews from '../../controllers/admin/reviews.controller.js'

const router = Router()
router.use(verifyToken, requireRole('admin'))

router.get('/',              reviews.list)
router.patch('/:id/toggle',  reviews.toggle)

export default router
