import { Router } from 'express'
import  * as authController from '../controllers/admin/auth.controller.js'

// Route MẪU cho module xác thực (A1). Route chỉ là lớp mỏng — logic nằm trong controller.
const router = Router()

router.post('/register', authController.register)
router.post('/login', authController.login)

export default router
