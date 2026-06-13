import { ok, created, fail } from '../utils/response.js'

// ============================================================
// CONTROLLER MẪU: Xác thực (A1)
// ============================================================
// Đây là KHUNG MẪU cho cả nhóm. Mọi controller theo cấu trúc:
//   - Hàm async, luôn bọc try/catch
//   - Lấy dữ liệu từ req.body / req.params
//   - Xử lý nghiệp vụ (gọi model/service)
//   - Trả về qua ok() / created() / fail()
//
// Phần kết nối DB còn bỏ trống — sẽ điền khi gắn MongoDB.
// ============================================================

export async function register(req, res) {
  try {
    const { email, mat_khau, ho_ten } = req.body

    // Validate cơ bản (luôn kiểm tra ở backend, không chỉ tin frontend)
    if (!email || !mat_khau || !ho_ten) {
      return fail(res, 400, 'Vui lòng nhập đầy đủ email, mật khẩu và họ tên')
    }

    // TODO (khi có DB):
    //   1. Kiểm tra email đã tồn tại chưa
    //   2. Hash mật khẩu bằng bcrypt
    //   3. Lưu user mới
    //   4. Tạo JWT trả về

    return created(res, { email, ho_ten }, 'Đăng ký thành công (khung mẫu)')
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

    // TODO (khi có DB):
    //   1. Tìm user theo email
    //   2. So sánh mật khẩu bằng bcrypt.compare
    //   3. Tạo JWT, trả về { token, user }

    return ok(res, { token: 'mau-jwt', user: { email } }, 'Đăng nhập thành công (khung mẫu)')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
