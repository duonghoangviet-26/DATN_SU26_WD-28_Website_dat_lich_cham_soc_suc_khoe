import mongoose from 'mongoose'

// ============================================================
// AUDIT LOG — Nhật ký thao tác toàn hệ thống
// Áp dụng cho: Admin (C1–C8) · Bác sĩ (B1–B4) · System/Cron
// ============================================================
// Chỉ INSERT — không update, không delete (immutable log).
// nguoi_thuc_hien_id=null khi vai_tro='system' (cron tự động).
// du_lieu_cu / du_lieu_moi: JSON snapshot trước/sau thay đổi,
//   chỉ ghi khi cần diff (PaymentSetting, Service, Specialty, ClinicInfo, Doctor profile).
//   Với các hành động chỉ đổi status (lock/approve) thì để null để tiết kiệm storage.

// ── DANH SÁCH hanh_dong ──────────────────────────────────────
// [Admin – User]
//   LOCK_USER | UNLOCK_USER
// [Admin – Doctor]
//   APPROVE_DOCTOR | REJECT_DOCTOR | SUSPEND_DOCTOR | RESTORE_DOCTOR
// [Admin – Service]
//   CREATE_SERVICE | UPDATE_SERVICE | HIDE_SERVICE | SHOW_SERVICE
// [Admin – Specialty]
//   CREATE_SPECIALTY | UPDATE_SPECIALTY | HIDE_SPECIALTY | RESTORE_SPECIALTY
// [Admin – ClinicInfo]
//   UPDATE_CLINIC_INFO
// [Admin – PaymentSetting]
//   UPDATE_PAYMENT_SETTING
// [Admin – Review]
//   HIDE_REVIEW | RESTORE_REVIEW | DELETE_REVIEW
// [Admin – Refund]
//   APPROVE_REFUND | REJECT_REFUND
// [Doctor – Profile]
//   UPDATE_DOCTOR_PROFILE
// [Doctor – Schedule]
//   CREATE_SCHEDULE | CANCEL_SLOT | UPDATE_SLOT
// [Doctor – ExaminationResult]
//   UPDATE_EXAMINATION_RESULT
//   KE_THUOC_BAT_CHAP_CANH_BAO_DI_UNG (bác sĩ override cảnh báo dị ứng thuốc — B47)
// [Doctor – Queue & Room]
//   CHANGE_DOCTOR_STATUS | CHECKIN_QUEUE | CALL_PATIENT | SKIP_PATIENT | ASSIGN_DOCTOR
//   loai_doi_tuong: queue_entry | room_status
// [Receptionist – WS-4 nhật ký ca trực]
//   LT_CHECK_IN | LT_HUY_CHECK_IN | LT_TAO_KHACH_VANG_LAI | LT_IN_PHIEU_STT
//   LT_XAC_NHAN_THANH_TOAN | LT_LAP_HOA_DON
//   LT_DOI_LICH | LT_HUY_LICH
//   LT_GOI_KHACH | LT_XU_LY_THONG_BAO_BS
//   loai_doi_tuong dùng thêm: queue_entry | walk_in_guest | payment | invoice
//                             | appointment | notification
// [System – Cron]
//   AUTO_CANCEL_APPOINTMENT (unpaid timeout)
//   LOCK_EXAMINATION_RESULT  (co_the_sua → false sau 24h)
//   MARK_REMINDER_MISSED     (sent → missed sau 2h)
// ─────────────────────────────────────────────────────────────

const auditLogSchema = new mongoose.Schema(
  {
    nguoi_thuc_hien_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null, // null khi vai_tro='system' (cron)
    },
    vai_tro: {
      type: String,
      // 'nurse': deprecated (actor Y tá đã bị xoá khỏi hệ thống — xem ADR
      // commit 0184a63). KHÔNG dùng cho bản ghi mới; giữ trong enum chỉ để
      // đọc được ~195 bản ghi audit lịch sử trước ngày xoá actor — đổi các
      // bản ghi đó sang 'doctor'/'receptionist' sẽ làm sai lịch sử vì hành
      // động (CALL_PATIENT, SKIP_PATIENT, CHANGE_DOCTOR_STATUS) khi đó thật
      // sự do tài khoản y tá thực hiện, không phải bác sĩ hay lễ tân.
      enum: ['admin', 'doctor', 'user', 'system', 'nurse', 'receptionist'],
      required: true,
    },
    hanh_dong:      { type: String, required: true, maxlength: 100 },
    loai_doi_tuong: {
      type: String,
      required: true,
      maxlength: 50,
      // user | doctor | service | specialty | clinic_info | payment_setting
      // | review | refund | doctor_schedule | examination_result
    },
    doi_tuong_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    ly_do:        { type: String, default: null },

    // Snapshot JSON trước/sau — chỉ ghi khi hành động thay đổi dữ liệu
    // (UPDATE_*, CREATE_*). Để null với các toggle status đơn giản.
    du_lieu_cu:  { type: mongoose.Schema.Types.Mixed, default: null },
    du_lieu_moi: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: false },
    collection: 'nhat_ky_thao_tac',
  }
)

auditLogSchema.index({ nguoi_thuc_hien_id: 1 })
auditLogSchema.index({ vai_tro: 1 })
auditLogSchema.index({ hanh_dong: 1 })
// Ghép thêm ngay_tao — E-3 loc theo hanh_dong ('CUSTOMER_CONTACT_REQUIRED'/'CUSTOMER_CONTACTED')
// VA khoang thoi gian (mac dinh 7 ngay gan nhat) trong cung mot truy van.
auditLogSchema.index({ hanh_dong: 1, ngay_tao: -1 })
auditLogSchema.index({ loai_doi_tuong: 1, doi_tuong_id: 1 }) // tra lịch sử của 1 đối tượng cụ thể
auditLogSchema.index({ ngay_tao: -1 })

export default mongoose.model('NhatKyThaoTac', auditLogSchema)
