import { Router } from 'express'
import * as userController from '../../controllers/receptionist/user.controller.js'

const router = Router()

router.get('/lookup', userController.lookupUser)

export default router
