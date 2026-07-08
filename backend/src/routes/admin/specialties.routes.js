import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import * as specialties from '../../controllers/admin/specialties.controller.js'
import {
  getSpecialtiesByClinic,
  getDoctorsBySpecialty,
  createSpecialtyForClinic,
  updateSpecialty as updateClinicSpecialty,
  toggleSpecialty as toggleClinicSpecialty,
  copySpecialty,
  getSpecialtyLogs,
} from '../../controllers/admin/clinic-info.controller.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

// Canonical singleton-specialty routes.
router.get('/', specialties.list)
router.post('/', specialties.create)

// Legacy aliases kept temporarily while older clients are being retired.
router.get('/specialties', specialties.list)
router.post('/specialties', specialties.create)
router.get('/specialties/:specialtyId/logs', getSpecialtyLogs)
router.get('/specialties/:specialtyId/doctors', getDoctorsBySpecialty)
router.put('/specialties/:specialtyId', updateClinicSpecialty)
router.patch('/specialties/:specialtyId/toggle', toggleClinicSpecialty)
router.post('/specialties/:specialtyId/copy', copySpecialty)
router.put('/specialties/:id', specialties.update)
router.patch('/specialties/:id/toggle', specialties.toggle)

router.get('/:id/logs', getSpecialtyLogs)
router.get('/:id/doctors', getDoctorsBySpecialty)
router.get('/:id', specialties.getById)
router.put('/:id', specialties.update)
router.patch('/:id/toggle', specialties.toggle)

router.get('/:id/specialties', getSpecialtiesByClinic)
router.post('/:id/specialties', createSpecialtyForClinic)

export default router
