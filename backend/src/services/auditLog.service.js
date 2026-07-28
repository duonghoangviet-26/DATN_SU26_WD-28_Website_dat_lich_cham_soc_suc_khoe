import { LichSuDangNhap } from '../models/index.js'

/**
 * Service ghi log lịch sử đăng nhập bất đồng bộ (Non-blocking / Fire-and-forget)
 */
export async function logAuthActivity({ userId, provider, ipAddress, userAgent, status = 'success', failureReason = null }) {
  try {
    await LichSuDangNhap.create({
      user_id: userId,
      provider,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      trang_thai: status,
      ly_do_that_bai: failureReason,
      thoi_gian: new Date(),
    })
  } catch (err) {
    console.error('[AUDIT LOG ERROR] Không thể ghi lịch sử đăng nhập:', err.message)
  }
}
