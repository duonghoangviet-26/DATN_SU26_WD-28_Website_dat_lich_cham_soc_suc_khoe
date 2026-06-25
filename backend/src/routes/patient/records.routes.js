import { Router } from 'express'
import { listRecords, getRecord } from '../../controllers/patient/records.controller.js'

const router = Router()

router.get('/',    listRecords)
router.get('/:id', getRecord)

export default router
