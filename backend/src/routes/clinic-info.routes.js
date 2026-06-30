import { Router } from 'express'
import {
  getAllClinics,
  getClinicById,
  createClinic,
  updateClinicInfo,
  deleteClinic,
  getSpecialtiesByClinic,
  getDoctorsBySpecialty,
  createSpecialtyForClinic,
  updateSpecialty,
  toggleSpecialty,
  copySpecialty,
  getClinicLogs,
  getSpecialtyLogs
} from '../controllers/clinic-info.controller.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Chỉ cho phép admin quản lý
router.use(verifyToken, requireRole('admin'))

// ---- Quản lý chi nhánh ----
router.get('/', getAllClinics)
router.post('/', createClinic)
router.get('/:id', getClinicById)
router.get('/:id/logs', getClinicLogs)
router.put('/:id', updateClinicInfo)
router.delete('/:id', deleteClinic)

// ---- Quản lý chuyên khoa của chi nhánh ----
router.get('/:id/specialties', getSpecialtiesByClinic)
router.get('/specialties/:specialtyId/logs', getSpecialtyLogs)
router.get('/specialties/:specialtyId/doctors', getDoctorsBySpecialty)
router.post('/:id/specialties', createSpecialtyForClinic)
router.put('/specialties/:specialtyId', updateSpecialty)
router.patch('/specialties/:specialtyId/toggle', toggleSpecialty)
router.post('/specialties/:specialtyId/copy', copySpecialty)

export default router
