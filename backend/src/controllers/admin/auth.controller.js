import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { NguoiDung, ThongBao } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { emitDashboardNewPatient } from '../../realtime/socket.js'
import { sendResetPasswordEmail } from '../../services/mail.service.js'

const ADMIN_ID = "000000000000000000000099"

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
      loai: 'system'
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
