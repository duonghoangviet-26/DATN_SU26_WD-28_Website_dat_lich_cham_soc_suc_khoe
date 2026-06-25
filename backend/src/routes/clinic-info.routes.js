import { Router } from 'express'
import {
  getAllClinics,
  getClinicById,
  createClinic,
  updateClinicInfo,
  deleteClinic
} from '../controllers/clinic-info.controller.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Chỉ cho phép admin quản lý
router.use(verifyToken, requireRole('admin'))

router.get('/', getAllClinics)
router.post('/', createClinic)
router.get('/:id', getClinicById)
router.put('/:id', updateClinicInfo)
router.delete('/:id', deleteClinic)

export default router
