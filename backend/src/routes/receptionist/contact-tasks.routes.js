import { Router } from 'express'
import contactTasksController from '../../controllers/receptionist/contact-tasks.controller.js'

const router = Router()

router.get('/', contactTasksController.getContactTasks)
router.patch('/:auditId/done', contactTasksController.markContactTaskDone)

export default router
