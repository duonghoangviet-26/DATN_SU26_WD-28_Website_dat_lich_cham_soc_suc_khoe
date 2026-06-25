import { Router } from 'express'
import * as prescriptions from '../../controllers/patient/prescriptions.controller.js'

const router = Router()

router.get('/',    prescriptions.listPrescriptions)
router.get('/:id', prescriptions.getPrescription)
router.post('/',   prescriptions.createPrescription)
router.put('/:id', prescriptions.updatePrescription)
router.delete('/:id', prescriptions.deletePrescription)

export default router
