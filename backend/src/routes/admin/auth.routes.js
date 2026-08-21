import { Router } from 'express'
import * as authController from '../../controllers/admin/auth.controller.js'
import { verifyToken } from '../../middlewares/auth.middleware.js'

// Route MẪU cho module xác thực (A1). Route chỉ là lớp mỏng — logic nằm trong controller.
const router = Router()

router.post('/register', authController.register)
router.post('/login', authController.login)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)

// Google OAuth 2.0 & Session Refresh / Logout / Onboarding
router.post('/google', authController.googleLogin)
router.post('/refresh-token', authController.refreshToken)
router.post('/logout', authController.logout)
router.post('/update-onboarding', verifyToken, authController.updateOnboarding)
router.get('/profile', verifyToken, authController.getProfile)
router.put('/profile', verifyToken, authController.updateProfile)
router.post('/change-password', verifyToken, authController.changePassword)

// 2FA Routes
router.get('/2fa/setup', verifyToken, authController.setup2FA)
router.post('/2fa/verify', verifyToken, authController.verify2FA)

export default router
