import { Router } from 'express'
import * as family from '../../controllers/patient/family.controller.js'

const router = Router()

router.get('/',              family.getFamily)
router.post('/',             family.createFamily)
router.post('/members',      family.addMember)
router.put('/members/:id',   family.updateMember)
router.delete('/members/:id', family.removeMember)

export default router
