import bcrypt from 'bcryptjs'
import { NguoiDung, NhatKyThaoTac, BacSi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

/**
 * Hàm trợ giúp ghi nhật ký thao tác
 */
async function logActivity(req, action, targetId, oldData = null, newData = null, reason = null) {
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: req.user.role,
      hanh_dong: action,
      loai_doi_tuong: 'user',
      doi_tuong_id: targetId,
      du_lieu_cu: oldData,
      du_lieu_moi: newData,
      ly_do: reason
    })
  } catch (error) {
    console.error('Lỗi ghi nhật ký thao tác:', error)
  }
}

/**
 * Lấy danh sách người dùng cho Admin
 */
export async function getAllUsers(req, res) {
  try {
    const { keyword, role, status, page = 1, limit = 10, sort = '-ngay_tao', isDeleted } = req.query

    // Xây dựng filter
    const query = {}

    // Xử lý lọc xóa mềm
    if (isDeleted === 'true') {
      query.ngay_xoa = { $ne: null } // Lấy những người đã xóa
    } else {
      query.ngay_xoa = null // Mặc định lấy những người chưa xóa
    }

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

    // Nếu tạo user với vai trò bác sĩ, tự động tạo hồ sơ bác sĩ
    // if (newUser.role === 'doctor') {
    //   await BacSi.create({
    //     user_id: newUser._id,
    //     trang_thai_duyet: 'approved',
    //     so_nam_kinh_nghiem: 0,
    //     phi_tu_van: 0,
    //     specialties: [],
    //     services: []
    //   })
    // }

    // 5. Ghi nhật ký
    await logActivity(req, 'CREATE_USER', newUser._id, null, {
      email, ho_ten, role: role || 'user'
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

    // Nếu vai trò chuyển thành bác sĩ, tự động tạo hoặc kích hoạt lại hồ sơ bác sĩ
    if (user.role === 'doctor') {
      const exists = await BacSi.findOne({ user_id: user._id })
      if (!exists) {
        await BacSi.create({
          user_id: user._id,
          trang_thai_duyet: 'approved',
          so_nam_kinh_nghiem: 0,
          phi_tu_van: 0,
          specialties: [],
          services: []
        })
      }
    }

    // Ghi nhật ký
    await logActivity(req, 'UPDATE_USER', user._id, null, { ho_ten, so_dien_thoai, role, status })

    return ok(res, user, 'Cập nhật thông tin người dùng thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Khóa / mở khóa tài khoản
 */
export async function toggleStatus(req, res) {
  try {
    const userId = req.params.id
    const adminId = req.user.id

    // 1. Ngăn admin tự khóa chính mình
    if (userId === adminId) {
      return fail(res, 400, 'Bạn không thể tự khóa tài khoản của chính mình')
    }

    const user = await NguoiDung.findById(userId)
    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng')
    }

    // 2. Đảo ngược trạng thái
    const oldStatus = user.status
    user.status = user.status === 'active' ? 'locked' : 'active'
    await user.save()

    // 3. Ghi nhật ký
    const action = user.status === 'active' ? 'UNLOCK_USER' : 'LOCK_USER'
    await logActivity(req, action, user._id, { status: oldStatus }, { status: user.status })

    return ok(res, user, `Đã ${user.status === 'active' ? 'mở khóa' : 'khóa'} tài khoản thành công`)
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Xóa mềm người dùng
 */
export async function softDeleteUser(req, res) {
  try {
    const userId = req.params.id
    const adminId = req.user.id

    if (userId === adminId) {
      return fail(res, 400, 'Bạn không thể tự xóa tài khoản của chính mình')
    }

    const user = await NguoiDung.findByIdAndUpdate(
      userId,
      { ngay_xoa: new Date() },
      { new: true }
    )

    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng')
    }

    // Ghi nhật ký
    await logActivity(req, 'SOFT_DELETE_USER', user._id)

    return ok(res, null, 'Đã xóa người dùng vào thùng rác thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Khôi phục người dùng đã xóa
 */
export async function restoreUser(req, res) {
  try {
    const user = await NguoiDung.findByIdAndUpdate(
      req.params.id,
      { ngay_xoa: null },
      { new: true }
    )

    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng')
    }

    // Ghi nhật ký
    await logActivity(req, 'RESTORE_USER', user._id)

    return ok(res, user, 'Khôi phục người dùng thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Thống kê người dùng
 */
export async function getUserStatistics(req, res) {
  try {
    const [
      total,
      admins,
      doctors,
      users,
      active,
      locked,
      deleted
    ] = await Promise.all([
      NguoiDung.countDocuments({ ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'admin', ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'doctor', ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'user', ngay_xoa: null }),
      NguoiDung.countDocuments({ status: 'active', ngay_xoa: null }),
      NguoiDung.countDocuments({ status: 'locked', ngay_xoa: null }),
      NguoiDung.countDocuments({ ngay_xoa: { $ne: null } })
    ])

    return ok(res, {
      total,
      roles: { admin: admins, doctor: doctors, user: users },
      status: { active, locked },
      deleted
    }, 'Lấy thống kê người dùng thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Xóa vĩnh viễn người dùng (Hard Delete)
 */
export async function hardDeleteUser(req, res) {
  try {
    const userId = req.params.id
    const adminId = req.user.id

    if (userId === adminId) {
      return fail(res, 400, 'Bạn không thể tự xóa vĩnh viễn tài khoản của chính mình')
    }

    const user = await NguoiDung.findById(userId)
    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng')
    }

    // Chỉ cho phép xóa vĩnh viễn nếu đã nằm trong thùng rác
    if (user.ngay_xoa === null) {
      return fail(res, 400, 'Người dùng phải được xóa vào thùng rác trước khi xóa vĩnh viễn')
    }

    await NguoiDung.findByIdAndDelete(userId)

    // Ghi nhật ký
    await logActivity(req, 'HARD_DELETE_USER', userId, { email: user.email, ho_ten: user.ho_ten })

    return ok(res, null, 'Đã xóa vĩnh viễn người dùng khỏi hệ thống')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Lấy danh sách nhật ký thao tác
 */
export async function getAuditLogs(req, res) {
  try {
    const { targetId, limit = 50 } = req.query
    const query = targetId ? { doi_tuong_id: targetId } : {}

    const logs = await NhatKyThaoTac.find(query)
      .populate('nguoi_thuc_hien_id', 'ho_ten email')
      .sort('-ngay_tao')
      .limit(parseInt(limit))

    return ok(res, logs, 'Lấy nhật ký thao tác thành công')
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}

/**
 * Thao tác hàng loạt trên nhiều người dùng
 */
export async function batchActionUsers(req, res) {
  try {
    const { ids, action, ly_do } = req.body
    const adminId = req.user.id

    if (!Array.isArray(ids) || ids.length === 0) {
      return fail(res, 400, 'Danh sách ID người dùng không hợp lệ')
    }

    const validActions = ['lock', 'unlock', 'delete', 'restore', 'hard-delete']
    if (!validActions.includes(action)) {
      return fail(res, 400, 'Hành động hàng loạt không hợp lệ')
    }

    // Lọc bỏ ID của chính admin thực hiện (ngăn tự khóa/xóa chính mình)
    const targetIds = ids.filter(id => id !== adminId)
    if (targetIds.length === 0) {
      return fail(res, 400, 'Không thể thực hiện hành động trên tài khoản của chính mình')
    }

    let count = 0

    if (action === 'hard-delete') {
      // Chỉ cho phép xóa vĩnh viễn những người dùng đã nằm trong thùng rác (ngay_xoa != null)
      const result = await NguoiDung.deleteMany({
        _id: { $in: targetIds },
        ngay_xoa: { $ne: null }
      })
      count = result.deletedCount

      // Ghi nhật ký thao tác hàng loạt
      if (count > 0) {
        await NhatKyThaoTac.create({
          nguoi_thuc_hien_id: adminId,
          vai_tro: req.user.role,
          hanh_dong: 'HARD_DELETE_USER',
          loai_doi_tuong: 'user',
          doi_tuong_id: null,
          ly_do: ly_do || `Xóa vĩnh viễn hàng loạt ${count} tài khoản khỏi hệ thống`,
        })
      }
    } else {
      let updateFields = {}
      let filter = { _id: { $in: targetIds } }

      if (action === 'lock') {
        updateFields = { status: 'locked' }
        filter.ngay_xoa = null // Chỉ khóa tài khoản chưa xóa
      } else if (action === 'unlock') {
        updateFields = { status: 'active' }
        filter.ngay_xoa = null // Chỉ mở khóa tài khoản chưa xóa
      } else if (action === 'delete') {
        updateFields = { ngay_xoa: new Date() }
        filter.ngay_xoa = null // Chỉ xóa mềm tài khoản chưa xóa
      } else if (action === 'restore') {
        updateFields = { ngay_xoa: null }
        filter.ngay_xoa = { $ne: null } // Chỉ khôi phục tài khoản đã xóa mềm
      }

      const result = await NguoiDung.updateMany(filter, { $set: updateFields })
      count = result.modifiedCount

      // Ghi nhật ký thao tác hàng loạt
      const actionLogNames = {
        lock: 'LOCK_USER',
        unlock: 'UNLOCK_USER',
        delete: 'SOFT_DELETE_USER',
        restore: 'RESTORE_USER',
      }

      const actionDescriptions = {
        lock: 'Khóa hàng loạt tài khoản',
        unlock: 'Mở khóa hàng loạt tài khoản',
        delete: 'Xóa mềm hàng loạt tài khoản',
        restore: 'Khôi phục hàng loạt tài khoản',
      }

      if (count > 0) {
        await NhatKyThaoTac.create({
          nguoi_thuc_hien_id: adminId,
          vai_tro: req.user.role,
          hanh_dong: actionLogNames[action],
          loai_doi_tuong: 'user',
          doi_tuong_id: null,
          ly_do: ly_do || `${actionDescriptions[action]} (Số lượng: ${count})`,
        })
      }
    }

    return ok(res, { count }, `Thực hiện thao tác hàng loạt thành công (${count} người dùng)`)
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}
