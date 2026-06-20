import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NguoiDung } from '../models/index.js'
import { ok, created, fail } from '../utils/response.js'

// ============================================================
// CONTROLLER: Xác thực (A1)
// POST /api/auth/register — Đăng ký
// POST /api/auth/login    — Đăng nhập → JWT
// ============================================================

export async function register(req, res) {
  try {
    const { email, mat_khau, ho_ten, so_dien_thoai } = req.body

    if (!email || !mat_khau || !ho_ten) {
      return fail(res, 400, 'Vui lòng nhập đầy đủ email, mật khẩu và họ tên')
    }

    const exists = await NguoiDung.findOne({ email: email.toLowerCase().trim() })
    if (exists) return fail(res, 409, 'Email đã được sử dụng')

    const hash = await bcrypt.hash(mat_khau, 10)
    const user = await NguoiDung.create({
      email, mat_khau: hash, ho_ten,
      so_dien_thoai: so_dien_thoai || null,
    })

    return created(res, {
      id:   user._id,
      email: user.email,
      ho_ten: user.ho_ten,
      role:   user.role,
      status: user.status,
      ngay_tao: user.ngay_tao,
    }, 'Đăng ký thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function login(req, res) {
  try {
    const { email, mat_khau } = req.body
    if (!email || !mat_khau) {
      return fail(res, 400, 'Vui lòng nhập email và mật khẩu')
    }

    // select('+mat_khau') vì field này bị ẩn mặc định
    const user = await NguoiDung.findOne({ email: email.toLowerCase().trim() })
      .select('+mat_khau')

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
        id:             user._id,
        email:          user.email,
        ho_ten:         user.ho_ten,
        so_dien_thoai:  user.so_dien_thoai,
        anh_dai_dien:   user.anh_dai_dien,
        role:           user.role,
        status:         user.status,
        ngay_tao:       user.ngay_tao,
      },
    }, 'Đăng nhập thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
