import { Router } from 'express'
import * as userController from '../controllers/user.controller.js'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Tất cả các route dưới đây yêu cầu quyền Admin
router.use(verifyToken, requireRole('admin'))

// Lấy danh sách & Thống kê
router.get('/', userController.getAllUsers)
router.get('/statistics', userController.getUserStatistics)
router.get('/logs', userController.getAuditLogs)
router.get('/:id', userController.getUserById)

// Tạo & Sửa
router.post('/', userController.createUser)
router.put('/:id', userController.updateUser)

// Các thao tác trạng thái
router.patch('/:id/toggle-lock', userController.toggleStatus)
router.patch('/:id/delete', userController.softDeleteUser)
router.patch('/:id/restore', userController.restoreUser)
router.delete('/:id/permanently', userController.hardDeleteUser)

export default router
