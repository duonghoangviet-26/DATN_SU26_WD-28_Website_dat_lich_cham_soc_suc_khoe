import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NguoiDung } from '../models/index.js'
import { ok, created, fail } from '../utils/response.js'

/**
 * Đăng ký tài khoản (A1)
 */
export async function register(req, res) {
  try {
    const { email, mat_khau, ho_ten, so_dien_thoai } = req.body

    if (!email || !mat_khau || !ho_ten) {
      return fail(res, 400, 'Vui lòng nhập đầy đủ email, mật khẩu và họ tên')
    }

    const existed = await NguoiDung.findOne({ email })
    if (existed) return fail(res, 400, 'Email này đã được đăng ký')

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(mat_khau, salt)

    const newUser = await NguoiDung.create({
      email,
      mat_khau: passwordHash,
      ho_ten,
      so_dien_thoai,
      role: 'user'
    })

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return created(res, { token, user: newUser }, 'Đăng ký thành công')
  } catch (err) {
    return fail(res, 500, 'Lỗi server: ' + err.message)
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

    // Tìm user và lấy luôn mật khẩu (vì select: false trong schema)
    const user = await NguoiDung.findOne({ email }).select('+mat_khau')
    if (!user) return fail(res, 401, 'Email hoặc mật khẩu không chính xác')

    if (user.status === 'locked') {
      return fail(res, 403, 'Tài khoản này hiện đang bị khóa')
    }

    const isMatch = await bcrypt.compare(mat_khau, user.mat_khau)
    if (!isMatch) return fail(res, 401, 'Email hoặc mật khẩu không chính xác')

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Ẩn mật khẩu khi trả về
    user.mat_khau = undefined

    return ok(res, { token, user }, 'Đăng nhập thành công')
  } catch (err) {
    return fail(res, 500, 'Lỗi server: ' + err.message)
  }
}
