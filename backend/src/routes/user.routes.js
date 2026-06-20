import { Router } from 'express'
import * as userController from '../controllers/user.controller.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Tất cả các route dưới đây yêu cầu quyền Admin
router.use(verifyToken, requireRole('admin'))

// Lưu ý: Route /statistics phải đặt TRÊN route /:id để không bị bắt nhầm tham số :id
router.get('/', userController.getAllUsers)
router.get('/statistics', userController.getUserStatistics)
router.get('/:id', userController.getUserById)

router.post('/', userController.createUser)
router.put('/:id', userController.updateUser)

router.patch('/:id/status', userController.toggleStatus)
router.patch('/:id/delete', userController.softDeleteUser)
router.patch('/:id/restore', userController.restoreUser)

export default router
