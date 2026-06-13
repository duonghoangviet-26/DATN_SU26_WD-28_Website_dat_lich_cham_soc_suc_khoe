// Hàm trả response chuẩn cho toàn hệ thống — đúng định dạng đã quy ước:
//   { success, message, data }
// Mọi controller dùng các hàm này để trả kết quả, không tự viết res.json lộn xộn.

export function ok(res, data = null, message = 'Thành công') {
  return res.status(200).json({ success: true, message, data })
}

export function created(res, data = null, message = 'Tạo thành công') {
  return res.status(201).json({ success: true, message, data })
}

export function fail(res, statusCode = 400, message = 'Có lỗi xảy ra') {
  return res.status(statusCode).json({ success: false, message })
}
