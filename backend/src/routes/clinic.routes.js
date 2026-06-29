import { Router } from 'express'
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js'
import {
  getSpecialties,
  createSpecialty,
  updateSpecialty,
  toggleSpecialty,
} from '../controllers/clinic.controller.js'

const router = Router()

// Bảo vệ toàn bộ route này: phải đăng nhập + phải là admin
router.use(verifyToken, requireRole('admin'))

// ---- Chuyên Khoa ----
router.get('/specialties', getSpecialties)                       // GET   /api/admin/clinic/specialties
router.post('/specialties', createSpecialty)                     // POST  /api/admin/clinic/specialties
router.put('/specialties/:id', updateSpecialty)                  // PUT   /api/admin/clinic/specialties/:id
router.patch('/specialties/:id/toggle', toggleSpecialty)         // PATCH /api/admin/clinic/specialties/:id/toggle

export default router
