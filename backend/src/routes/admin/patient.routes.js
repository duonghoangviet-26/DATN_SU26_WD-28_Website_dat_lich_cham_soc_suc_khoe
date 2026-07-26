import { Router } from 'express'
import * as patientController from '../../controllers/admin/patient.controller.js'
import { requireRole, verifyToken } from '../../middlewares/auth.middleware.js'

const router = Router()

router.use(verifyToken, requireRole('admin'))

router.get('/', patientController.getPatients)
router.get('/statistics', patientController.getPatientStatistics)
router.get('/:id', patientController.getPatientById)
router.get('/:id/exam-history', patientController.getPatientExamHistory)
router.get('/:id/audit-logs', patientController.getPatientAuditLogs)
router.put('/:id', patientController.updatePatient)
router.patch('/:id/lock', patientController.lockPatient)
router.patch('/:id/unlock', patientController.unlockPatient)
router.patch('/:id/delete', patientController.softDeletePatient)
router.patch('/:id/restore', patientController.restorePatient)

export default router
