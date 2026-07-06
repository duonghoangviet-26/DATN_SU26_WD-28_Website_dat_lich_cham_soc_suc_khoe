import { Router } from 'express'

import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as controller from '../../controllers/admin/medical-read.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/exam-results', controller.getExamResults)
router.get('/exam-results/:id', controller.getExamResultById)
router.get('/specialty-results/:type', controller.getSpecialtyResults)
router.get('/prescriptions', controller.getPrescriptions)
router.get('/prescriptions/:id', controller.getPrescriptionById)
router.get('/vitals', controller.getVitals)
router.get('/vitals/:id', controller.getVitalById)

export default router
