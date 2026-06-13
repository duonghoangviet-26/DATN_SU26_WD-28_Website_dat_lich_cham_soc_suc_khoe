# VitaFamily — Database (27 bảng)

> Nhóm đã chọn **MongoDB** — file này là tóm tắt cấu trúc dữ liệu để viết schema Mongoose.
> SQL gốc (MySQL): `Tài liệu dự án/Cơ sở dữ liệu/VitaFamily_Database.sql`

---

## Sơ đồ quan hệ (tóm tắt)

```
users ──────────────┬──→ families ──→ members
  │                 │
  ├──→ doctors ─────┼──→ doctor_specialties ──→ specialties
  │     │           │──→ doctor_hospitals   ──→ hospitals
  │     │           │──→ doctor_schedules ──→ slots
  │     │
  │     └──→ appointments ──→ payments ──→ refunds
  │               │
  │               ├──→ medical_records
  │               ├──→ examination_results
  │               ├──→ reviews
  │               └──→ prescriptions ──→ prescription_items ──→ reminders
  │
  ├──→ notifications
  ├──→ password_resets
  ├──→ fcm_tokens
  └──→ chat_sessions ──→ chat_messages
```

---

## Chi tiết từng bảng

### Nhóm 1 — Tài khoản & Xác thực

**`users`** — Tài khoản người dùng
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `email` | String | Duy nhất, không đổi sau đăng ký |
| `mat_khau` | String | bcrypt hash |
| `ho_ten` | String | |
| `so_dien_thoai` | String | Không bắt buộc |
| `anh_dai_dien` | String | URL |
| `role` | `user`/`doctor`/`admin` | Đổi sang `doctor` khi Admin duyệt |
| `status` | `active`/`locked` | |

**`password_resets`** — OTP quên mật khẩu (hết hạn 15 phút, dùng 1 lần)

**`fcm_tokens`** — Token thiết bị cho Firebase push notification

---

### Nhóm 2 — Danh mục

**`hospitals`** — Bệnh viện/phòng khám (`status`: `active`/`hidden`)

**`specialties`** — Chuyên khoa y tế (có `slug` URL-friendly, có `thu_tu` hiển thị)

**`services`** — Gói dịch vụ khám (`status`: `active`/`inactive`). Giá snapshot vào appointment khi đặt.

**`payment_settings`** — Key-value cấu hình (chính sách hoàn tiền, % hoa hồng). Không hardcode trong code.

---

### Nhóm 3 — Gia đình

**`families`** — Nhóm gia đình. 1 `users` → 1 `families`.

**`members`** — Thành viên gia đình
- `la_chu_ho = 1`: chủ hộ, không xóa được
- `ngay_xoa`: soft delete (giữ lại hồ sơ y tế)
- Tối đa 10 thành viên/nhóm

---

### Nhóm 4 — Hồ sơ bác sĩ

**`doctors`** — Hồ sơ chuyên môn
- `trang_thai_duyet`: `pending` → `approved`/`rejected` → `suspended`
- `so_lan_nop` ≤ 5
- `diem_danh_gia`, `tong_danh_gia`: tự cập nhật khi review thay đổi

**`doctor_specialties`** — Bác sĩ ↔ Chuyên khoa (nhiều-nhiều)

**`doctor_hospitals`** — Bác sĩ ↔ Bệnh viện (nhiều-nhiều)

**`doctor_schedules`** — Lịch làm việc theo ngày (1 bác sĩ 1 ngày 1 lịch)

**`slots`** — Khung giờ khám trong ngày
- `so_benh_nhan_toi_da` / `so_benh_nhan_hien_tai`
- Dùng SELECT FOR UPDATE khi tăng `so_benh_nhan_hien_tai`

---

### Nhóm 5 — Lịch hẹn & Thanh toán

**`appointments`** — ⭐ Bảng trung tâm
- `loai_kham`: `clinic`/`home`/`video`
- `status`: `pending` → `confirmed` → `completed` / `cancelled`
- `payment_status`: `unpaid` → `paid` → `refunded`
- `gia_kham`: snapshot giá lúc đặt
- `member_id = NULL`: lịch khách (lưu `ten_khach`, `so_dien_thoai_khach`)
- `unpaid` quá 15 phút → cron tự hủy

**`payments`** — Thanh toán mock (1 lịch hẹn = 1 payment)

**`refunds`** — Hoàn tiền (1 lịch hẹn = 1 refund, rejected không tạo lại)

---

### Nhóm 6 — Hồ sơ y tế

**`medical_records`** — Hồ sơ khám bệnh
- `nguon`: `tu_kham` (từ B4) hoặc `thu_cong` (bệnh nhân tự nhập)
- `tu_kham` không cho bệnh nhân sửa/xóa

**`examination_results`** — Kết quả sau khám (bác sĩ ghi)
- `co_the_sua = 1` trong 24h đầu; sau đó `= 0` (khóa)
- 1 lịch hẹn = 1 kết quả

---

### Nhóm 7 — Đơn thuốc & Nhắc nhở

**`prescriptions`** — Đơn thuốc (tối đa 10 loại thuốc)

**`prescription_items`** — Chi tiết từng thuốc
- `gio_uong`: JSON array `["07:00", "12:00", "19:00"]`
- Tối đa 90 ngày/đơn

**`reminders`** — 1 dòng = 1 lần nhắc cụ thể
- `status`: `pending` → `sent` (cron 5 phút) → `taken` (bệnh nhân xác nhận) / `missed` (quá 2 tiếng)

---

### Nhóm 8–11 — Đánh giá · Thông báo · Chatbot · Nhật ký

**`reviews`** — 1 lịch hẹn = 1 đánh giá (1–5 sao). Không sửa sau khi gửi.
- `status`: `visible`/`hidden`. Hidden không tính vào rating.

**`notifications`** — Thông báo cá nhân. Đã đọc xóa sau 90 ngày.

**`system_notifications`** — Thông báo Admin gửi hàng loạt. Gửi ngay, không thu hồi.

**`chat_sessions`** / **`chat_messages`** — Phiên chat AI Gemini. Đóng sau 24h không hoạt động.

**`audit_logs`** — Mọi thao tác quan trọng của Admin (LOCK_USER, APPROVE_DOCTOR, CANCEL_APPOINTMENT...).

---

## Điểm thiết kế quan trọng (cần nhớ khi viết code)

1. `appointments.slot_id` → dùng transaction + SELECT FOR UPDATE khi tăng `so_benh_nhan_hien_tai`
2. `members`: soft delete bằng `ngay_xoa`, chủ hộ không xóa được
3. `examination_results.co_the_sua`: khóa sau 24h — xử lý ở tầng ứng dụng (cron hoặc kiểm tra khi update)
4. `refunds`: UNIQUE `appointment_id` — 1 lịch chỉ 1 refund, rejected không tạo lại
5. `payment_settings`: tất cả tỉ lệ lấy từ DB, không hardcode
6. `doctors.diem_danh_gia`: tự cập nhật mỗi khi review bị ẩn/xóa/hiện
7. `notifications.related_id + related_type`: dùng để điều hướng khi click thông báo
