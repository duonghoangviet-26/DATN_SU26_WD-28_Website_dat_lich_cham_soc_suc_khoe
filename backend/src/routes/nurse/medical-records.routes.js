import { Router } from 'express'
import * as records from '../../controllers/nurse/medical-records.controller.js'

const router = Router()

router.get('/revisions',   records.listRevisions) // phải đứng trước '/:id'
router.get('/',            records.list)
router.get('/:id',         records.getById)
router.post('/',           records.createDraft)
router.patch('/:id',       records.update)
router.patch('/:id/submit',   records.submit)
router.patch('/:id/resubmit', records.resubmit)

export default router
