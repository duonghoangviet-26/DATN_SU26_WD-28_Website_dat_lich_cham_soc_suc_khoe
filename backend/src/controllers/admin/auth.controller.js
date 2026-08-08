import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { GiaDinh, HoSoBenhNhan, NguoiDung, NhatKyThaoTac, ThanhVien, ThongBao, UserSession } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { emitDashboardNewPatient } from '../../realtime/socket.js'
import { sendResetPasswordEmail } from '../../services/mail.service.js'
import { logAuthActivity } from '../../services/auditLog.service.js'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const ADMIN_ID = "000000000000000000000099"

function normalizePatientPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('84') ? `0${digits.slice(2)}` : digits
}

async function syncDirectPatientProfile(userId, hoTen, soDienThoai, extra = {}) {
  const phone = normalizePatientPhone(soDienThoai)
  const setFields = {
    ho_ten: hoTen.trim(),
  }
  if (phone) {
    setFields.so_dien_thoai = phone
    setFields.so_dien_thoai_tim_kiem = phone
  }
  for (const field of ['ngay_sinh', 'gioi_tinh', 'nhom_mau', 'di_ung', 'benh_nen', 'dia_chi', 'ghi_chu']) {
    if (extra[field] !== undefined) setFields[field] = extra[field]
  }
  const profile = await HoSoBenhNhan.findOneAndUpdate(
    { tai_khoan_id: userId, trang_thai: 'active' },
    { $set: setFields, $setOnInsert: { nguon_tao: 'online', trang_thai: 'active' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  )

  try {
    let family = await GiaDinh.findOne({ user_id: userId })
    if (!family) {
      family = await GiaDinh.create({
        user_id: userId,
        ten_nhom: `Gia đình ${hoTen.trim()}`,
      })
    }

    const memberUpdate = {
      ho_ten: hoTen.trim(),
      tai_khoan_id: userId,
      family_id: family._id,
      ho_so_benh_nhan_id: profile._id,
      la_chu_ho: true,
    }
    if (extra.ngay_sinh !== undefined) memberUpdate.ngay_sinh = extra.ngay_sinh
    if (extra.gioi_tinh !== undefined) memberUpdate.gioi_tinh = extra.gioi_tinh
    if (extra.nhom_mau !== undefined) memberUpdate.nhom_mau = extra.nhom_mau
    if (extra.di_ung !== undefined) memberUpdate.di_ung = extra.di_ung
    if (extra.benh_nen !== undefined) memberUpdate.benh_nen = extra.benh_nen

    await ThanhVien.findOneAndUpdate(
      {
        $or: [
          { tai_khoan_id: userId, la_chu_ho: true },
          { family_id: family._id, la_chu_ho: true },
        ]
      },
      { $set: memberUpdate },
      { upsert: true, new: true }
    )
  } catch (err) {
    console.error('Lỗi đồng bộ ThanhVien từ client profile:', err.message)
  }

  return profile
}

// ============================================================
// CONTROLLER: Xác thực (A1)
// POST /api/auth/register — Đăng ký
// POST /api/auth/login    — Đăng nhập → JWT
// ============================================================


export async function register(req, res) {
  try {
    let {
      email,
      mat_khau,
      ho_ten,
      so_dien_thoai,
    } = req.body

    // Validate bắt buộc
    if (!email || !mat_khau || !ho_ten) {
      return fail(
        res,
        400,
        'Vui lòng nhập đầy đủ email, mật khẩu và họ tên',
      )
    }

    // Chuẩn hóa dữ liệu
    email = email.trim().toLowerCase()
    ho_ten = ho_ten.trim()
    so_dien_thoai = so_dien_thoai?.trim()

    // Validate họ tên
    const nameRegex = /^[\p{L}\s-]+$/u
    const repeatingRegex = /(.)\1{2,}/i

    if (
      ho_ten.length < 5 ||
      ho_ten.length > 100 ||
      !nameRegex.test(ho_ten) ||
      repeatingRegex.test(ho_ten)
    ) {
      return fail(
        res,
        400,
        'Họ và tên không hợp lệ (phải từ 5-100 ký tự, không chứa số, ký tự đặc biệt hoặc ký tự lặp lại quá 2 lần)',
      )
    }

    // Validate email
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(email)) {
      return fail(
        res,
        400,
        'Email không đúng định dạng',
      )
    }

    // Validate mật khẩu
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

    if (!passwordRegex.test(mat_khau)) {
      return fail(
        res,
        400,
        'Mật khẩu phải tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số',
      )
    }

    // Validate số điện thoại
    if (
      so_dien_thoai &&
      !/^0\d{9}$/.test(so_dien_thoai)
    ) {
      return fail(
        res,
        400,
        'Số điện thoại phải gồm 10 số và bắt đầu bằng số 0',
      )
    }

    // Kiểm tra email tồn tại
    const exists =
      await NguoiDung.findOne({
        email,
        ngay_xoa: null,
      })

    if (exists) {
      return fail(
        res,
        409,
        'Email đã được sử dụng',
      )
    }

    // Hash mật khẩu
    const hash =
      await bcrypt.hash(
        mat_khau,
        10,
      )

    // Tạo tài khoản
    const user =
      await NguoiDung.create({
        email,
        mat_khau: hash,
        ho_ten,
        so_dien_thoai:
          so_dien_thoai || null,
      })

    // Gửi thông báo cho Admin
    await ThongBao.create({
      user_id: ADMIN_ID,
      tieu_de: 'Người dùng mới đăng ký',
      noi_dung: `Người dùng ${ho_ten} (${email}) vừa tạo tài khoản thành công.`,
      loai: 'system',
      ngay_gui_du_kien: new Date(),
    })
    emitDashboardNewPatient(user.ngay_tao)

    return created(
      res,
      {
        id: user._id,
        email: user.email,
        ho_ten: user.ho_ten,
        role: user.role,
        status: user.status,
        ngay_tao: user.ngay_tao,
      },
      'Đăng ký thành công',
    )


  } catch (err) {
    console.error(err)

    return fail(
      res,
      500,
      'Đã xảy ra lỗi hệ thống',
    )
  }
}

/**
 * Đăng nhập (A1)
 */
export async function login(req, res) {
  try {
    const { email, mat_khau } = req.body
    if (!email || !mat_khau) {
      return fail(res, 400, 'Vui lòng nhập email và mật khẩu')
    }

    const user = await NguoiDung.findOne({ 
      email: email.toLowerCase().trim(),
      ngay_xoa: null // Chặn người dùng đã bị xóa mềm
    }).select('+mat_khau')

    if (!user) return fail(res, 401, 'Email hoặc mật khẩu không đúng')
    if (user.status === 'locked') return fail(res, 403, 'Tài khoản đã bị khóa')

    if (!user.mat_khau) {
      return fail(res, 400, 'Tài khoản này được đăng ký bằng Google. Vui lòng đăng nhập bằng Google hoặc bấm "Quên mật khẩu" để tạo mật khẩu.')
    }

    const match = await bcrypt.compare(mat_khau, user.mat_khau)
    if (!match) return fail(res, 401, 'Email hoặc mật khẩu không đúng')

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    )

    return ok(res, {
      token,
      user: {
        id: user._id,
        email: user.email,
        ho_ten: user.ho_ten,
        so_dien_thoai: user.so_dien_thoai,
        anh_dai_dien: user.anh_dai_dien,
        role: user.role,
        status: user.status,
        ngay_tao: user.ngay_tao,
      },
    }, 'Đăng nhập thành công')
  } catch (err) {
    return fail(res, 500, 'Lỗi server: ' + err.message)
  }
}

/**
 * Quên mật khẩu (A1 - Bước 2)
 */
export async function forgotPassword(req, res) {
  try {
    let { email } = req.body
    if (!email) {
      return fail(res, 400, 'Vui lòng cung cấp email')
    }

    email = email.trim().toLowerCase()

    // Validate định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return fail(res, 400, 'Email không đúng định dạng')
    }

    // Tìm người dùng chưa bị xóa mềm
    const user = await NguoiDung.findOne({ email, ngay_xoa: null })

    // Phản hồi bảo mật: Không tiết lộ email có tồn tại hay không (Email Enumeration protection)
    if (!user) {
      return ok(res, null, 'Nếu email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi.')
    }

    // Tạo token ngẫu nhiên
    const rawToken = crypto.randomBytes(32).toString('hex')

    // Băm token trước khi lưu vào DB để tăng tính bảo mật
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

    // Lưu token và thời hạn hết hạn (15 phút) vào DB
    user.reset_password_token = hashedToken
    user.reset_password_expire = new Date(Date.now() + 15 * 60 * 1000)
    await user.save()

    // Gửi email chứa link reset password thực tế
    try {
      await sendResetPasswordEmail({ to: user.email, token: rawToken })
      console.log(`- Email reset password đã gửi thành công tới: ${user.email}`)
    } catch (emailErr) {
      console.error(`- Lỗi khi gửi email reset tới ${user.email}:`, emailErr.message)
    }

    // Trả cả token về client để dễ kiểm thử ở Bước 2 & 3
    return ok(res, {
      rawToken,
      hashedToken,
      expiresAt: user.reset_password_expire
    }, 'Mã đặt lại mật khẩu đã được tạo và gửi qua Email')

  } catch (err) {
    console.error(err)
    return fail(res, 500, 'Đã xảy ra lỗi hệ thống: ' + err.message)
  }
}

/**
 * Đặt lại mật khẩu mới (A1 - Bước 4)
 */
export async function resetPassword(req, res) {
  try {
    const { token, mat_khau_moi } = req.body
    if (!token || !mat_khau_moi) {
      return fail(res, 400, 'Vui lòng cung cấp mã token và mật khẩu mới')
    }

    // Validate định dạng mật khẩu mới
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(mat_khau_moi)) {
      return fail(
        res,
        400,
        'Mật khẩu mới phải tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số',
      )
    }

    // Băm token đầu vào bằng SHA-256 để tìm bản lưu khớp trong DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Tìm người dùng chưa bị xóa mềm, khớp token và còn hạn sử dụng
    const user = await NguoiDung.findOne({
      reset_password_token: hashedToken,
      reset_password_expire: { $gt: new Date() },
      ngay_xoa: null
    })

    if (!user) {
      return fail(res, 400, 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')
    }

    // Mã hóa mật khẩu mới bằng bcrypt
    const hash = await bcrypt.hash(mat_khau_moi, 10)

    // Cập nhật mật khẩu và xóa các trường token
    user.mat_khau = hash
    if (!user.providers.includes('local')) {
      user.providers.push('local')
    }
    user.reset_password_token = null
    user.reset_password_expire = null
    await user.save()

    return ok(res, null, 'Đặt lại mật khẩu mới thành công')

  } catch (err) {
    console.error(err)
    return fail(res, 500, 'Đã xảy ra lỗi hệ thống: ' + err.message)
  }
}

/**
 * Đăng nhập / Đăng ký qua Google OAuth 2.0
 */
export async function googleLogin(req, res) {
  try {
    const { credential } = req.body
    if (!credential) {
      return fail(res, 400, 'Vui lòng cung cấp Google Credential')
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.email) {
      return fail(res, 400, 'Xác thực Google thất bại hoặc email không tồn tại')
    }

    if (!payload.email_verified) {
      return fail(res, 400, 'Địa chỉ email Google của bạn chưa được xác minh')
    }

    const { email, sub: google_id, name: ho_ten, picture: anh_dai_dien } = payload
    const normalizedEmail = email.trim().toLowerCase()

    let user = await NguoiDung.findOne({ google_id, ngay_xoa: null })

    if (!user) {
      user = await NguoiDung.findOne({ email: normalizedEmail, ngay_xoa: null })

      if (user) {
        user.google_id = google_id
        if (!user.providers.includes('google')) {
          user.providers.push('google')
        }
        user.anh_dai_dien_google = anh_dai_dien
        user.email_verified = true
        await user.save()
      } else {
        user = await NguoiDung.create({
          email: normalizedEmail,
          ho_ten: ho_ten || 'Người dùng Google',
          google_id,
          providers: ['google'],
          mat_khau: null,
          role: 'user',
          status: 'active',
          email_verified: true,
          anh_dai_dien_google: anh_dai_dien,
          requires_onboarding: true,
        })

        emitDashboardNewPatient({
          id: user._id,
          email: user.email,
          ho_ten: user.ho_ten,
        })
      }
    }

    if (user.role !== 'user' && user.role !== 'patient') {
      logAuthActivity({
        userId: user._id,
        provider: 'google',
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        status: 'failed',
        failureReason: 'Chặn quyền Quản trị/Bác sĩ/Lễ tân đăng nhập Google',
      })
      return fail(res, 403, 'Tài khoản Quản trị/Bác sĩ/Lễ tân chỉ được phép đăng nhập bằng Email & Mật khẩu nội bộ')
    }

    if (user.status === 'locked') {
      logAuthActivity({
        userId: user._id,
        provider: 'google',
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        status: 'failed',
        failureReason: 'Tài khoản bị khóa',
      })
      return fail(res, 403, 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên')
    }

    const now = new Date()
    user.last_login_at = now
    user.last_login_provider = 'google'
    await user.save()

    logAuthActivity({
      userId: user._id,
      provider: 'google',
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      status: 'success',
    })

    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ACCESS_SECRET_KEY',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || 'REFRESH_SECRET_KEY',
      { expiresIn: '7d' }
    )

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await UserSession.create({
      user_id: user._id,
      refresh_token_hash: refreshTokenHash,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip || req.headers['x-forwarded-for'],
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return ok(
      res,
      {
        token: accessToken,
        user: {
          id: user._id,
          email: user.email,
          ho_ten: user.ho_ten,
          role: user.role,
          so_dien_thoai: user.so_dien_thoai,
          anh_dai_dien: user.anh_dai_dien || user.anh_dai_dien_google,
          requires_onboarding: !user.so_dien_thoai || user.requires_onboarding,
        },
      },
      'Đăng nhập Google thành công'
    )
  } catch (err) {
    console.error('Google Auth Error:', err)
    return fail(res, 401, 'Xác thực Google không hợp lệ hoặc đã hết hạn')
  }
}

/**
 * Làm mới Token (Refresh Token)
 */
export async function refreshToken(req, res) {
  try {
    const tokenStr = req.cookies?.refreshToken || req.body?.refreshToken
    if (!tokenStr) {
      return fail(res, 401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
    }

    const decoded = jwt.verify(tokenStr, process.env.JWT_REFRESH_SECRET || 'REFRESH_SECRET_KEY')
    const tokenHash = crypto.createHash('sha256').update(tokenStr).digest('hex')

    const session = await UserSession.findOne({ refresh_token_hash: tokenHash, is_revoked: false })
    if (!session) {
      res.clearCookie('refreshToken')
      return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã bị đăng xuất')
    }

    const user = await NguoiDung.findOne({ _id: decoded.id, ngay_xoa: null })
    if (!user || user.status === 'locked') {
      res.clearCookie('refreshToken')
      return fail(res, 403, 'Tài khoản không tồn tại hoặc đã bị khóa')
    }

    const newAccessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ACCESS_SECRET_KEY',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    return ok(res, { token: newAccessToken }, 'Làm mới token thành công')
  } catch (err) {
    res.clearCookie('refreshToken')
    return fail(res, 401, 'Refresh Token không hợp lệ hoặc đã hết hạn')
  }
}

/**
 * Đăng xuất tài khoản & Revoke session
 */
export async function logout(req, res) {
  try {
    const tokenStr = req.cookies?.refreshToken || req.body?.refreshToken
    if (tokenStr) {
      const tokenHash = crypto.createHash('sha256').update(tokenStr).digest('hex')
      await UserSession.updateOne({ refresh_token_hash: tokenHash }, { is_revoked: true })
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    return ok(res, null, 'Đăng xuất thành công')
  } catch (err) {
    return fail(res, 500, 'Lỗi khi đăng xuất: ' + err.message)
  }
}

/**
 * Cập nhật thông tin Onboarding (Bổ sung SĐT cho Google User)
 */
export async function updateOnboarding(req, res) {
  try {
    const userId = req.user.id
    const { so_dien_thoai, ho_ten } = req.body

    if (!so_dien_thoai) {
      return fail(res, 400, 'Vui lòng cung cấp số điện thoại')
    }
    const normalizedPhone = normalizePatientPhone(so_dien_thoai)
    if (!/^0\d{9,10}$/.test(normalizedPhone)) {
      return fail(res, 400, 'Số điện thoại không đúng định dạng')
    }

    const user = await NguoiDung.findOne({ _id: userId, ngay_xoa: null })
    if (!user) {
      return fail(res, 404, 'Tài khoản không tồn tại')
    }

    // Kiểm tra Unique: số điện thoại không được trùng với tài khoản khác
    const phoneExists = await NguoiDung.findOne({
      so_dien_thoai: normalizedPhone,
      _id: { $ne: userId },
      ngay_xoa: null,
    })
    if (phoneExists) {
      return fail(res, 400, 'Số điện thoại này đã được sử dụng bởi một tài khoản khác trong hệ thống.')
    }

    user.so_dien_thoai = normalizedPhone
    if (ho_ten) user.ho_ten = ho_ten.trim()
    user.requires_onboarding = false
    await user.save()
    await syncDirectPatientProfile(user._id, user.ho_ten, user.so_dien_thoai)

    return ok(res, {
      id: user._id,
      email: user.email,
      ho_ten: user.ho_ten,
      so_dien_thoai: user.so_dien_thoai,
      requires_onboarding: false,
    }, 'Cập nhật thông tin thành công')
  } catch (err) {
    return fail(res, 500, 'Lỗi cập nhật thông tin: ' + err.message)
  }
}

/**
 * Cập nhật thông tin tài khoản bệnh nhân.
 * Chỉ cập nhật dữ liệu hồ sơ hiện tại; các lịch hẹn cũ giữ nguyên snapshot
 * tên/số điện thoại đã dùng tại thời điểm đặt lịch để bảo toàn lịch sử khám.
 */
export async function getProfile(req, res) {
  try {
    const user = await NguoiDung.findOne({ _id: req.user.id, ngay_xoa: null }).lean()
    if (!user) return fail(res, 404, 'TÃ i khoáº£n khÃ´ng tá»“n táº¡i')
    const profile = await HoSoBenhNhan.findOne({ tai_khoan_id: user._id, trang_thai: 'active' })
      .select('ngay_sinh gioi_tinh nhom_mau di_ung benh_nen dia_chi ghi_chu')
      .lean()

    return ok(res, {
      id: String(user._id),
      email: user.email,
      ho_ten: user.ho_ten,
      so_dien_thoai: user.so_dien_thoai,
      anh_dai_dien: user.anh_dai_dien,
      role: user.role,
      status: user.status,
      requires_onboarding: Boolean(user.requires_onboarding),
      ngay_sinh: profile?.ngay_sinh ?? null,
      gioi_tinh: profile?.gioi_tinh ?? null,
      nhom_mau: profile?.nhom_mau ?? null,
      di_ung: profile?.di_ung ?? null,
      benh_nen: profile?.benh_nen ?? null,
      dia_chi: profile?.dia_chi ?? null,
      ghi_chu: profile?.ghi_chu ?? null,
    })
  } catch (err) {
    return fail(res, 500, 'Lá»—i táº£i há»“ sÆ¡: ' + err.message)
  }
}

export async function updateProfile(req, res) {
  try {
    const user = await NguoiDung.findOne({ _id: req.user.id, ngay_xoa: null })
    if (!user) return fail(res, 404, 'Tài khoản không tồn tại')

    const {
      ho_ten,
      so_dien_thoai,
      ngay_sinh,
      gioi_tinh,
      nhom_mau,
      di_ung,
      benh_nen,
      dia_chi,
      ghi_chu,
    } = req.body ?? {}
    if (!ho_ten?.trim()) return fail(res, 400, 'Họ tên là bắt buộc')
    
    let normalizedPhone = user.so_dien_thoai || null
    if (so_dien_thoai !== undefined && so_dien_thoai !== null && String(so_dien_thoai).trim() !== '') {
      const phoneInput = String(so_dien_thoai).trim()
      // Nếu SĐT không đổi so với SĐT hiện tại của tài khoản, giữ nguyên và bỏ qua validate trùng/định dạng
      if (phoneInput !== user.so_dien_thoai) {
        normalizedPhone = normalizePatientPhone(phoneInput)
        if (normalizedPhone && !/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(normalizedPhone) && !/^0\d{9,10}$/.test(normalizedPhone)) {
          return fail(res, 400, 'Số điện thoại không đúng định dạng (phải là 10 chữ số hợp lệ)')
        }

        if (normalizedPhone) {
          const phoneExists = await NguoiDung.findOne({
            so_dien_thoai: normalizedPhone,
            _id: { $ne: user._id },
            ngay_xoa: null,
          })
          if (phoneExists) {
            return fail(res, 400, 'Số điện thoại này đã được sử dụng bởi một tài khoản khác trong hệ thống.')
          }
        }
      }
    } else if (so_dien_thoai === '') {
      normalizedPhone = null
    }

    if (ngay_sinh && (Number.isNaN(new Date(ngay_sinh).getTime()) || new Date(ngay_sinh) >= new Date())) {
      return fail(res, 400, 'Ngày sinh không hợp lệ')
    }
    if (gioi_tinh && !['nam', 'nu', 'khac'].includes(gioi_tinh)) return fail(res, 400, 'Giới tính không hợp lệ')
    if (nhom_mau && !['A', 'B', 'AB', 'O'].includes(nhom_mau)) return fail(res, 400, 'Nhóm máu không hợp lệ')

    const oldProfile = await HoSoBenhNhan.findOne({ tai_khoan_id: user._id, trang_thai: 'active' }).lean()
    const oldUserHoTen = user.ho_ten
    const oldUserPhone = user.so_dien_thoai

    user.ho_ten = ho_ten.trim()
    user.so_dien_thoai = normalizedPhone
    // Google chỉ dùng để xác thực danh tính. Khi bệnh nhân đã hoàn tất hồ sơ
    // trong hệ thống, lần đăng nhập Google sau không được đưa họ về trạng thái
    // onboarding hoặc lấy lại thông tin hồ sơ cũ từ Google.
    user.requires_onboarding = false
    await user.save()
    const profile = await syncDirectPatientProfile(user._id, user.ho_ten, user.so_dien_thoai, {
      ngay_sinh: ngay_sinh ? new Date(ngay_sinh) : null,
      gioi_tinh: gioi_tinh || null,
      nhom_mau: nhom_mau || null,
      di_ung: di_ung?.trim() || null,
      benh_nen: benh_nen?.trim() || null,
      dia_chi: dia_chi?.trim() || null,
      ghi_chu: ghi_chu?.trim() || null,
    })

    const oldLogData = {}
    const newLogData = {}
    const checkFields = [
      { key: 'ho_ten', oldVal: oldUserHoTen, newVal: ho_ten.trim() },
      { key: 'so_dien_thoai', oldVal: oldUserPhone, newVal: normalizedPhone },
      { key: 'primary_member.ngay_sinh', oldVal: oldProfile?.ngay_sinh ? new Date(oldProfile.ngay_sinh).toISOString().split('T')[0] : null, newVal: ngay_sinh || null },
      { key: 'primary_member.gioi_tinh', oldVal: oldProfile?.gioi_tinh || null, newVal: gioi_tinh || null },
      { key: 'primary_member.nhom_mau', oldVal: oldProfile?.nhom_mau || null, newVal: nhom_mau || null },
      { key: 'primary_member.di_ung', oldVal: oldProfile?.di_ung || null, newVal: di_ung?.trim() || null },
      { key: 'primary_member.benh_nen', oldVal: oldProfile?.benh_nen || null, newVal: benh_nen?.trim() || null },
    ]

    for (const item of checkFields) {
      if (String(item.oldVal ?? '') !== String(item.newVal ?? '')) {
        oldLogData[item.key] = item.oldVal
        newLogData[item.key] = item.newVal
      }
    }

    if (Object.keys(newLogData).length > 0) {
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: user._id,
        vai_tro: user.role || 'user',
        hanh_dong: 'CLIENT_UPDATE_PROFILE',
        loai_doi_tuong: 'patient',
        doi_tuong_id: user._id,
        du_lieu_cu: oldLogData,
        du_lieu_moi: newLogData,
      })
    }

    return ok(res, {
      id: String(user._id),
      email: user.email,
      ho_ten: user.ho_ten,
      so_dien_thoai: user.so_dien_thoai,
      anh_dai_dien: user.anh_dai_dien,
      role: user.role,
      status: user.status,
      requires_onboarding: false,
      ngay_sinh: profile?.ngay_sinh ?? null,
      gioi_tinh: profile?.gioi_tinh ?? null,
      nhom_mau: profile?.nhom_mau ?? null,
      di_ung: profile?.di_ung ?? null,
      benh_nen: profile?.benh_nen ?? null,
      dia_chi: profile?.dia_chi ?? null,
      ghi_chu: profile?.ghi_chu ?? null,
    }, 'Cập nhật thông tin cá nhân thành công')
  } catch (err) {
    return fail(res, 500, 'Lỗi cập nhật thông tin cá nhân: ' + err.message)
  }
}

/**
 * Tạo mã bí mật và QR Code để cài đặt 2FA
 */
export async function setup2FA(req, res) {
  try {
    const user = await NguoiDung.findOne({ _id: req.user.id, ngay_xoa: null })
    if (!user) return fail(res, 404, 'Tài khoản không tồn tại')

    // Bỏ qua nếu đã bật 2FA
    if (user.is_2fa_enabled) {
      return fail(res, 400, 'Tài khoản này đã bật 2FA rồi')
    }

    // Tạo mã bí mật (secret)
    const secret = speakeasy.generateSecret({ name: 'VitaFamily Admin' })
    
    // Tạo URI cho QR Code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url)

    // Lưu trữ tạm secret vào DB (nhưng chưa kích hoạt)
    user.totp_secret = secret.base32
    await user.save()

    return ok(res, { secret: secret.base32, qrCodeUrl }, 'Tạo mã QR thành công')
  } catch (err) {
    console.error(err)
    return fail(res, 500, 'Lỗi tạo mã QR 2FA: ' + err.message)
  }
}

/**
 * Xác thực mã 2FA và hoàn tất cài đặt
 */
export async function verify2FA(req, res) {
  try {
    const { token } = req.body
    if (!token) return fail(res, 400, 'Vui lòng cung cấp mã 2FA')

    const user = await NguoiDung.findOne({ _id: req.user.id, ngay_xoa: null }).select('+totp_secret')
    if (!user) return fail(res, 404, 'Tài khoản không tồn tại')

    if (!user.totp_secret) {
      return fail(res, 400, 'Bạn chưa khởi tạo 2FA. Vui lòng tạo QR code trước.')
    }

    // Xác thực mã với secret đã lưu
    const isValid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: token,
      window: 1
    })
    
    if (!isValid) {
      return fail(res, 400, 'Mã 2FA không chính xác hoặc đã hết hạn')
    }

    // Xác thực thành công -> Bật cờ 2FA
    user.is_2fa_enabled = true
    await user.save()

    return ok(res, null, 'Cài đặt xác thực 2 bước (2FA) thành công!')
  } catch (err) {
    console.error(err)
    return fail(res, 500, 'Lỗi xác minh 2FA: ' + err.message)
  }
}
