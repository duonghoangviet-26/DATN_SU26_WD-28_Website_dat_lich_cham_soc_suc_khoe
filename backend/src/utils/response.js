// Hàm trả response chuẩn cho toàn hệ thống — đúng định dạng đã quy ước:
//   { success, message, data }
// Mọi controller dùng các hàm này để trả kết quả, không tự viết res.json lộn xộn.

export function ok(res, data = null, message = 'Thành công') {
  return res.status(200).json({ success: true, message, data })
}

export function created(res, data = null, message = 'Tạo thành công') {
  return res.status(201).json({ success: true, message, data })
}

function formatErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'Có lỗi xảy ra, vui lòng thử lại.'
  
  // Chuyển đổi các lỗi JS Runtime / Reference / Type error thô
  if (
    msg.includes('is not defined') ||
    msg.includes('Cannot read') ||
    msg.includes('is not a function') ||
    msg.includes('ReferenceError') ||
    msg.includes('TypeError')
  ) {
    return 'Lỗi xử lý dữ liệu từ máy chủ. Vui lòng thử lại sau.'
  }

  // Chuyển đổi các lỗi validation Mongo/Mongoose thô sang tiếng Việt thân thiện
  if (msg.includes('validation failed') || msg.includes('Cast to ObjectId failed') || msg.includes('is not a valid enum value')) {
    return 'Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.'
  }
  if (msg.includes('E11000 duplicate key')) {
    return 'Dữ liệu đã tồn tại trong hệ thống.'
  }
  if (msg.includes('jwt expired') || msg.includes('jwt malformed')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }
  if (msg.includes('MongoServerError') || msg.includes('ECONNREFUSED')) {
    return 'Hệ thống đang bận. Vui lòng thử lại sau.'
  }
  
  return msg
}

export function fail(res, statusCode = 400, message = 'Có lỗi xảy ra', data = null) {
  const cleanMsg = formatErrorMessage(message)
  return res.status(statusCode).json({ success: false, message: cleanMsg, ...(data !== null ? { data } : {}) })
}
