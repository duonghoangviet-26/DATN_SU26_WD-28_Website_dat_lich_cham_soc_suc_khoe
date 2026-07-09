import { Router } from 'express'
import {
  getAllClinics,
  getCurrentClinic,
  getClinicById,
  createClinic,
  upsertCurrentClinic,
  updateClinicInfo,
  deleteClinic,
  getClinicLogs,
  getCurrentClinicLogs,
} from '../../controllers/admin/clinic-info.controller.js'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/current', getCurrentClinic)
router.get('/current/logs', getCurrentClinicLogs)
router.put('/current', upsertCurrentClinic)

router.get('/', getAllClinics)
router.post('/', createClinic)
router.get('/:id', getClinicById)
router.get('/:id/logs', getClinicLogs)
router.put('/:id', updateClinicInfo)
router.delete('/:id', deleteClinic)

export default router
