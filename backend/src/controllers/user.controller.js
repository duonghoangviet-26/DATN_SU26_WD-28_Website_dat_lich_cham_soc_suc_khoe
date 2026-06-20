import bcrypt from 'bcryptjs'
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
  try {
    const user = await NguoiDung.findById(req.params.id)
    
    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng')
    }

    return ok(res, user, 'Lấy chi tiết người dùng thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}


/**
 * Admin tạo user mới
 */
export async function createUser(req, res) {
  try {
    const { email, mat_khau, ho_ten, so_dien_thoai, role } = req.body

    // 1. Validate dữ liệu
    if (!email || !mat_khau || !ho_ten) {
      return fail(res, 400, 'Vui lòng nhập đầy đủ email, mật khẩu và họ tên')
    }

    // 2. Kiểm tra email tồn tại
    const existed = await NguoiDung.findOne({ email })
    if (existed) {
      return fail(res, 400, 'Email này đã được đăng ký trong hệ thống')
    }

    // 3. Hash mật khẩu
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(mat_khau, salt)

    // 4. Tạo user
    const newUser = await NguoiDung.create({
      email,
      mat_khau: hashedPassword,
      ho_ten,
      so_dien_thoai,
      role: role || 'user'
    })

    return res.status(201).json({
      success: true,
      message: 'Người dùng đã được tạo thành công',
      data: newUser
    })
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Cập nhật thông tin người dùng
 */
export async function updateUser(req, res) {
  try {
    const { ho_ten, so_dien_thoai, role, status } = req.body
    
    // Tìm và cập nhật (chỉ cập nhật các trường được gửi lên)
    const user = await NguoiDung.findByIdAndUpdate(
      req.params.id,
      { ho_ten, so_dien_thoai, role, status },
      { new: true, runValidators: true }
    )

    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng để cập nhật')
    }

    return ok(res, user, 'Cập nhật thông tin người dùng thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
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
