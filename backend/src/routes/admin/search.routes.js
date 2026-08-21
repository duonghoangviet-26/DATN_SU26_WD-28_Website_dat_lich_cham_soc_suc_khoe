import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import { globalSearch } from '../../controllers/admin/search.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', globalSearch)

export default router
