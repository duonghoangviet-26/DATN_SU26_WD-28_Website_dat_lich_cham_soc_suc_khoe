import bcrypt from 'bcryptjs'
import { NguoiDung, NhatKyThaoTac, BacSi, ThongBao } from '../../models/index.js'
import speakeasy from 'speakeasy'

import { ok, fail } from '../../utils/response.js'
import { emitDashboardNewPatient } from '../../realtime/socket.js'

const ADMIN_ID = "000000000000000000000099"
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADMIN_MANAGED_ROLES = ['user', 'patient', 'doctor', 'admin', 'receptionist']
const DEFAULT_RESET_PASSWORD = '123456'

function buildDefaultDoctorProfile(userId) {
  return {
    user_id: userId,
    trang_thai_duyet: 'pending',
    so_nam_kinh_nghiem: 0,
    gia_kham: 0,
    phi_kham: 0,
    specialties: [],
    services: [],
    related_services: [],
    la_hien: true,
  }
}

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

    if (role) {
      if (!ADMIN_MANAGED_ROLES.includes(role)) {
        return fail(res, 400, 'Vai trò không hợp lệ')
      }
      query.role = role
    } else {
      query.role = { $in: ADMIN_MANAGED_ROLES }
    }
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
    let { email, mat_khau, ho_ten, so_dien_thoai, anh_dai_dien, role } = req.body

    // 1. Validate dữ liệu
    if (!email || !mat_khau || !ho_ten) {
      return fail(res, 400, 'Vui lòng nhập đầy đủ email, mật khẩu và họ tên')
    }

    email = String(email).trim().toLowerCase()
    if (!EMAIL_REGEX.test(email)) {
      return fail(res, 400, 'Email không đúng định dạng')
    }

    // 2. Kiểm tra email tồn tại
    const existed = await NguoiDung.findOne({ email, ngay_xoa: null })
    if (existed) {
      return fail(res, 400, 'Email này đã được đăng ký trong hệ thống')
    }

    // 3. Hash mật khẩu
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(mat_khau, salt)

    // 4. Tạo user
    const normalizedRole = role || 'user'
    if (!ADMIN_MANAGED_ROLES.includes(normalizedRole)) {
      return fail(res, 400, 'Vai trò không hợp lệ')
    }

    const newUser = await NguoiDung.create({
      email,
      mat_khau: hashedPassword,
      ho_ten,
      so_dien_thoai,
      anh_dai_dien: anh_dai_dien || null,
      role: normalizedRole
    })

    if (['user', 'patient'].includes(newUser.role)) {
      emitDashboardNewPatient(newUser.ngay_tao)
    }

    // NẾU LÀ BÁC SĨ -> TẠO NGAY HỒ SƠ BÁC SĨ (để xuất hiện bên Quản lý Bác sĩ)
    if (newUser.role === 'doctor') {
      await BacSi.create(buildDefaultDoctorProfile(newUser._id))

      // Gửi thông báo cho Admin
      await ThongBao.create({
        user_id: ADMIN_ID,
        tieu_de: 'Bác sĩ mới cần duyệt',
        noi_dung: `Tài khoản bác sĩ ${ho_ten} (${email}) vừa được tạo. Vui lòng kiểm tra và duyệt hồ sơ.`,
        loai: 'system'
      })
    }


    // 5. Ghi nhật ký
    await logActivity(req, 'CREATE_USER', newUser._id, null, {
      email, ho_ten, anh_dai_dien: anh_dai_dien || null, role: normalizedRole
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
    const oldUser = await NguoiDung.findById(req.params.id).lean()
    if (!oldUser) {
      return fail(res, 404, 'Không tìm thấy người dùng để cập nhật')
    }

    const { email, ho_ten, so_dien_thoai, anh_dai_dien, role, status } = req.body

    const updateData = {}
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase()
      if (!normalizedEmail) {
        return fail(res, 400, 'Vui lòng nhập email')
      }
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return fail(res, 400, 'Email không đúng định dạng')
      }

      const existed = await NguoiDung.findOne({
        email: normalizedEmail,
        ngay_xoa: null,
        _id: { $ne: req.params.id },
      }).lean()
      if (existed) {
        return fail(res, 400, 'Email này đã được đăng ký trong hệ thống')
      }

      updateData.email = normalizedEmail
    }
    if (ho_ten !== undefined) updateData.ho_ten = ho_ten
    if (so_dien_thoai !== undefined) updateData.so_dien_thoai = so_dien_thoai
    if (role !== undefined) {
      if (!ADMIN_MANAGED_ROLES.includes(role)) {
        return fail(res, 400, 'Vai trò không hợp lệ')
      }
      updateData.role = role
    }
    if (status !== undefined) updateData.status = status
    if (anh_dai_dien !== undefined) {
      updateData.anh_dai_dien = anh_dai_dien || null
    }

    const oldLogData = {}
    const newLogData = {}
    for (const [field, newValue] of Object.entries(updateData)) {
      if (newValue === undefined) continue
      const oldValue = oldUser[field] ?? null
      const normalizedNewValue = newValue ?? null
      if (String(oldValue ?? '') !== String(normalizedNewValue ?? '')) {
        oldLogData[field] = oldValue
        newLogData[field] = normalizedNewValue
      }
    }

    // Tìm và cập nhật (chỉ cập nhật các trường được gửi lên)
    const user = await NguoiDung.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!user) {
      return fail(res, 404, 'Không tìm thấy người dùng để cập nhật')
    }

    // Nếu vai trò chuyển thành bác sĩ, tự động tạo hồ sơ bác sĩ mặc định nếu chưa có.
    if (user.role === 'doctor') {
      const exists = await BacSi.findOne({ user_id: user._id })
      if (!exists) {
        await BacSi.create(buildDefaultDoctorProfile(user._id))

        // Gửi thông báo cho Admin
        await ThongBao.create({
          user_id: ADMIN_ID,
          tieu_de: 'Có hồ sơ bác sĩ mới cần duyệt',
          noi_dung: `Người dùng ${user.ho_ten} vừa được nâng cấp thành Bác sĩ. Vui lòng kiểm tra hồ sơ.`,
          loai: 'system'
        })
      }
    }

    // Ghi nhật ký
    if (Object.keys(newLogData).length > 0) {
      await logActivity(req, 'UPDATE_USER', user._id, oldLogData, newLogData)
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
 * Reset mật khẩu người dùng về mật khẩu mặc định.
 */
export async function resetUserPassword(req, res) {
  try {
    const user = await NguoiDung.findById(req.params.id).select('+mat_khau')
    if (!user) {
      return fail(res, 404, 'Khong tim thay nguoi dung')
    }

    if (user.ngay_xoa !== null) {
      return fail(res, 400, 'Khong the reset mat khau tai khoan da nam trong thung rac')
    }

    const salt = await bcrypt.genSalt(10)
    user.mat_khau = await bcrypt.hash(DEFAULT_RESET_PASSWORD, salt)
    user.reset_password_token = null
    user.reset_password_expire = null

    if (!Array.isArray(user.providers)) {
      user.providers = ['local']
    } else if (!user.providers.includes('local')) {
      user.providers.push('local')
    }

    await user.save()
    await logActivity(
      req,
      'RESET_PASSWORD',
      user._id,
      null,
      { password_reset: true, default_password_applied: true },
      'Admin reset password to default value'
    )

    const safeUser = await NguoiDung.findById(user._id)
    return ok(
      res,
      { user: safeUser, default_password: DEFAULT_RESET_PASSWORD },
      'Da reset mat khau ve mac dinh 123456'
    )
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
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
    const oldUser = await NguoiDung.findById(req.params.id).lean()
    if (!oldUser) {
      return fail(res, 404, 'Không tìm thấy người dùng')
    }

    const activeEmailOwner = await NguoiDung.findOne({
      email: oldUser.email,
      ngay_xoa: null,
      _id: { $ne: req.params.id },
    }).lean()
    if (activeEmailOwner) {
      return fail(res, 400, 'Không thể khôi phục vì email này đang được tài khoản khác sử dụng')
    }

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
      receptionists,
      users,
      active,
      locked,
      deleted
    ] = await Promise.all([
      NguoiDung.countDocuments({ role: { $in: ADMIN_MANAGED_ROLES }, ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'admin', ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'doctor', ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'receptionist', ngay_xoa: null }),
      NguoiDung.countDocuments({ role: 'user', ngay_xoa: null }),
      NguoiDung.countDocuments({ status: 'active', ngay_xoa: null }),
      NguoiDung.countDocuments({ status: 'locked', ngay_xoa: null }),
      NguoiDung.countDocuments({ ngay_xoa: { $ne: null } })
    ])

    return ok(res, {
      total,
      roles: { admin: admins, doctor: doctors, receptionist: receptionists, user: users },
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
      const { ids, action, ly_do, totp_code, confirm_text } = req.body
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
  
      if (action === 'hard-delete' || action === 'delete') {
        // Kiểm tra mã xác nhận (Lớp 1)
        const expectedConfirm = action === 'hard-delete' ? 'XOA-VINH-VIEN' : 'XOA-TAI-KHOAN'
        if (confirm_text !== expectedConfirm) {
          return fail(res, 400, 'Chuỗi xác nhận không chính xác')
        }

        // Lấy thông tin Admin để kiểm tra 2FA (Lớp 2)
        const adminUser = await NguoiDung.findById(adminId).select('+totp_secret')
        if (!adminUser || !adminUser.is_2fa_enabled || !adminUser.totp_secret) {
          return fail(res, 400, 'Tài khoản của bạn chưa kích hoạt Xác thực 2 bước (2FA). Vui lòng kích hoạt 2FA trước khi thực hiện thao tác này.')
        }

        if (!totp_code) {
          return fail(res, 400, 'Vui lòng cung cấp mã Google Authenticator')
        }

        const isValid = speakeasy.totp.verify({
          secret: adminUser.totp_secret,
          encoding: 'base32',
          token: totp_code,
          window: 1
        })
        if (!isValid) {
          return fail(res, 400, 'Mã Google Authenticator không chính xác hoặc đã hết hạn')
        }
      }

      if (action === 'hard-delete') {
        // Chỉ cho phép xóa vĩnh viễn những người dùng đã nằm trong thùng rác (ngay_xoa != null)
      const result = await NguoiDung.deleteMany({
        _id: { $in: targetIds },
        ngay_xoa: { $ne: null }
      })
      count = result.deletedCount

      // Ghi nhật ký thao tác hàng loạt
      if (count > 0) {
        const logs = targetIds.map(id => ({
          nguoi_thuc_hien_id: adminId,
          vai_tro: req.user.role,
          hanh_dong: 'HARD_DELETE_USER',
          loai_doi_tuong: 'user',
          doi_tuong_id: id,
          ly_do: ly_do || `Xóa vĩnh viễn tài khoản khỏi hệ thống`,
        }))
        await NhatKyThaoTac.insertMany(logs)
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
        const logs = targetIds.map(id => ({
          nguoi_thuc_hien_id: adminId,
          vai_tro: req.user.role,
          hanh_dong: actionLogNames[action],
          loai_doi_tuong: 'user',
          doi_tuong_id: id,
          ly_do: ly_do || `${actionDescriptions[action]}`,
        }))
        await NhatKyThaoTac.insertMany(logs)
      }
    }

    return ok(res, { count }, `Thực hiện thao tác hàng loạt thành công (${count} người dùng)`)
  } catch (error) {
    return fail(res, 500, 'Lỗi server: ' + error.message)
  }
}
