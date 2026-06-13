import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'

// ============================================================
// MIDDLEWARE MẪU: Xác thực & Phân quyền
// ============================================================
// Quy ước: verifyToken phải đặt TRƯỚC requireRole.
//   router.get('/admin/users', verifyToken, requireRole('admin'), controller.list)
// ============================================================

// Kiểm tra JWT trong header "Authorization: Bearer <token>"
export function verifyToken(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return fail(res, 401, 'Thiếu token đăng nhập')
  }

  const token = header.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded // gắn thông tin user vào request để dùng ở controller
    next()
  } catch {
    return fail(res, 401, 'Token không hợp lệ hoặc đã hết hạn')
  }
}

// Giới hạn quyền theo vai trò. Dùng: requireRole('admin') hoặc requireRole('doctor', 'admin')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'Bạn không có quyền truy cập chức năng này')
    }
    next()
  }
}
