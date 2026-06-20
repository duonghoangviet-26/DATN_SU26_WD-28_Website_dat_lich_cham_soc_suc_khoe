import { NguoiDung } from '../models/index.js'
import { ok, fail } from '../utils/response.js'

/**
 * Lấy danh sách người dùng cho Admin
 */
export async function getAllUsers(req, res) {
  try {
    const { keyword, role, status, page = 1, limit = 10, sort = '-ngay_tao' } = req.query

    // Xây dựng filter
    const query = { ngay_xoa: null } // Không lấy user đã bị xóa mềm

    if (keyword) {
      query.$or = [
        { ho_ten: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } }
      ]
    }

    if (role) query.role = role
    if (status) query.status = status

    // Tính toán phân trang
    const skip = (parseInt(page) - 1) * parseInt(limit)

    // Thực thi query
    const [users, total] = await Promise.all([
      NguoiDung.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      NguoiDung.countDocuments(query)
    ])

    const totalPages = Math.ceil(total / parseInt(limit))

    // Trả về theo format yêu cầu
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách người dùng thành công',
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    })
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Lấy chi tiết một người dùng
 */
export async function getUserById(req, res) {
  // Sẽ làm ở bước sau
}

/**
 * Admin tạo user mới
 */
export async function createUser(req, res) {
  // Sẽ làm ở bước sau
}

/**
 * Cập nhật thông tin người dùng
 */
export async function updateUser(req, res) {
  // Sẽ làm ở bước sau
}

/**
 * Khóa / mở khóa tài khoản
 */
export async function toggleStatus(req, res) {
  // Sẽ làm ở bước sau
}

/**
 * Xóa mềm người dùng
 */
export async function softDeleteUser(req, res) {
  // Sẽ làm ở bước sau
}

/**
 * Khôi phục người dùng đã xóa
 */
export async function restoreUser(req, res) {
  // Sẽ làm ở bước sau
}

/**
 * Thống kê người dùng
 */
export async function getUserStatistics(req, res) {
  // Sẽ làm ở bước sau
}
