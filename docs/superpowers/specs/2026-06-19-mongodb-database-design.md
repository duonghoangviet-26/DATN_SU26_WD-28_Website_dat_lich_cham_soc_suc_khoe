# VitaFamily — Thiết kế Database MongoDB v2.0 (Phòng khám tư, 1 cơ sở)

> **Ngày:** 2026-06-19
> **Trạng thái:** Đã duyệt — đang triển khai
> **Stack:** MongoDB Atlas + Mongoose (ESM)
> **Nguồn gốc:** Chuyển đổi từ `Tài liệu dự án/Cơ sở dữ liệu/VitaFamily_Database.sql` (27 bảng MySQL),
> hợp nhất `docs/Đặc tả trang web và database/database.md` (bản 23 collection), và **sửa lại logic
> sai theo mô hình phòng khám tư 1 cơ sở**.

---

## 1. Mục tiêu

DB hoàn chỉnh, đủ logic nghiệp vụ cho **toàn bộ 20 chức năng** (A1–A7, B1–B5, C1–C8) sao cho khi
phát triển các chức năng con về sau **không phải sửa schema**. Đầu ra gồm:

```
backend/src/models/*.js   ← Mongoose schema + index + validation (nguồn sự thật)
backend/src/seed/seed.js  ← Kết nối MONGODB_URI (Atlas) → nạp dữ liệu mẫu + đồng bộ index
backend/tests/*.test.js   ← Vitest + mongodb-memory-server: kiểm chứng ràng buộc & nghiệp vụ
```

Quy trình dùng chung của nhóm: `git pull` → đặt `MONGODB_URI` Atlas vào `.env` → `npm run seed`.

---

## 2. Mô hình nghiệp vụ — Phòng khám tư 1 cơ sở (các sửa đổi quan trọng)

| Logic cũ (SAI cho phòng khám tư) | Sửa thành |
|---|---|
| `hospitals` (nhiều bệnh viện liên kết) | ❌ Bỏ → thêm `clinic_info` (1 doc duy nhất: tên, địa chỉ, SĐT, email, giờ làm, mô tả, logo) |
| `doctors.hospitals[]`, bảng join `doctor_hospitals` | ❌ Bỏ (mọi bác sĩ thuộc cùng 1 phòng khám) |
| `appointments.hospital_id` | ❌ Bỏ (clinic = tại phòng khám; home = `dia_chi_kham` của bệnh nhân) |
| `payouts` (chi trả bệnh viện) + `hoa_hong_phan_tram` 15% | ❌ Bỏ → tiền thanh toán là **doanh thu trực tiếp của phòng khám** |
| `appointments.loai_kham` có `video` | ❌ Bỏ `video` → chỉ `clinic` / `home` |
| `services.loai` có `video` | ❌ Bỏ → chỉ `clinic` / `home` |
| `notifications` TTL index trên `ngay_tao` | ❌ Sai — sẽ xóa cả thông báo **chưa đọc**. Sửa: cron xóa `da_doc=true` quá 90 ngày, KHÔNG dùng TTL index |
| `medical_records.ten_benh_vien` | Giữ — dùng cho hồ sơ `thu_cong` (bệnh nhân tự nhập lần khám ở nơi khác); hồ sơ `tu_kham` mặc định tên phòng khám |

C8 (Quản lý thanh toán) sau khi sửa = **thanh toán (payments) + hoàn tiền (refunds) + cấu hình
chính sách (payment_settings) + báo cáo doanh thu** (qua aggregation, không cần collection riêng).

---

## 3. Danh sách 23 collection

| # | Collection | Nhóm | Ghi chú |
|---|---|---|---|
| 1 | `users` | Tài khoản | role: user/doctor/admin |
| 2 | `password_resets` | Tài khoản | OTP, TTL index |
| 3 | `clinic_info` 🆕 | Danh mục | 1 doc duy nhất — thông tin phòng khám |
| 4 | `specialties` | Danh mục | chuyên khoa |
| 5 | `services` | Danh mục | gói dịch vụ (clinic/home) |
| 6 | `payment_settings` | Danh mục | chính sách hoàn tiền (bỏ hoa hồng) |
| 7 | `families` | Gia đình | 1 user 1 family |
| 8 | `members` | Gia đình | ≤10/family, soft delete |
| 9 | `doctors` | Bác sĩ | embed `specialties[]`, `services[]` |
| 10 | `doctor_schedules` | Bác sĩ | embed `slots[]` |
| 11 | `appointments` | Lịch hẹn | clinic/home, snapshot `gia_kham` |
| 12 | `payments` | Tiền | 1 appointment 1 payment |
| 13 | `refunds` | Tiền | 1 appointment 1 refund |
| 14 | `medical_records` | Hồ sơ y tế | tu_kham/thu_cong |
| 15 | `examination_results` | Hồ sơ y tế | khóa sau 24h |
| 16 | `prescriptions` | Đơn thuốc | embed `items[]` (≤10) |
| 17 | `reminders` | Đơn thuốc | cron nhắc thuốc |
| 18 | `reviews` | Đánh giá | 1 appointment 1 review |
| 19 | `notifications` | Thông báo | cá nhân |
| 20 | `system_notifications` | Thông báo | Admin gửi hàng loạt |
| 21 | `chat_sessions` | Chatbot | đóng sau 24h |
| 22 | `chat_messages` | Chatbot | ≤1000 ký tự |
| 23 | `audit_logs` | Nhật ký | chỉ insert |

---

## 4. Ràng buộc nghiệp vụ ENFORCE trong schema

- **members**: ≤10/family (pre-validate hook đếm member còn sống); `la_chu_ho` không xóa; soft delete `ngay_xoa`
- **prescriptions.items**: ≤10 phần tử; mỗi item `ngay_ket_thuc ≤ ngay_bat_dau + 90 ngày`; `gio_uong` mảng "HH:MM"
- **doctors**: `so_lan_nop ≤ 5`; `diem_danh_gia` 0–5; `trang_thai_duyet` đổi → cập nhật `users.role`
- **reviews**: `so_sao` integer 1–5; unique `appointment_id`
- **services**: `thoi_gian_phut` 10–480; `gia ≥ 0`; `ma_dich_vu` auto-gen "DV001"; `khu_vuc[]` chỉ khi `loai=home`
- **appointments**: `clinic`→`dia_chi_kham=null`; `home`→`dia_chi_kham` bắt buộc (custom validator); `gia_kham` snapshot
- **slots**: `gio_ket_thuc > gio_bat_dau`; `so_benh_nhan_hien_tai ≤ so_benh_nhan_toi_da`; home→max=1
- **Unique index**: `users.email`, `clinic_info` (singleton), `families.user_id`, `doctors.user_id`,
  `payments.appointment_id`, `refunds.appointment_id`, `examination_results.appointment_id`,
  `reviews.appointment_id`, `doctor_schedules{doctor_id,ngay}`, `services.ma_dich_vu`, `specialties.slug`

---

## 5. Logic xuyên chức năng (xử lý ở tầng service/cron, DB hỗ trợ)

1. **Đặt slot atomic** — `findOneAndUpdate` với điều kiện `so_benh_nhan_hien_tai < so_benh_nhan_toi_da` + `$inc` (thay SELECT FOR UPDATE).
2. **Snapshot giá** — `appointment.gia_kham = service.gia` lúc đặt.
3. **Duyệt bác sĩ** — transaction: `doctors.trang_thai_duyet=approved` + `users.role=doctor` + audit log.
4. **Cập nhật rating** — khi review đổi `status`: `diem_danh_gia = avg(so_sao visible)`, `tong_danh_gia = count`.
5. **Khóa kết quả khám** — `co_the_sua=false` sau 24h.
6. **Chính sách hoàn tiền** — đọc từ `payment_settings`, tính % theo khoảng giờ hủy.
7. **Home appointment** — luôn `pending`, bác sĩ confirm thủ công sau khi xem `dia_chi_kham`.
8. **Cron** — hủy unpaid >15', gửi reminder, đánh dấu missed >2h, khóa kết quả >24h, đóng chat >24h, xóa notification đã đọc >90 ngày.

---

## 6. Kế hoạch test (Vitest + mongodb-memory-server)

Mỗi collection: test field bắt buộc, enum, giới hạn (11 thuốc/91 ngày/6 lần nộp → reject), unique.
Nghiệp vụ: race-condition slot, snapshot giá, duyệt bác sĩ đổi role, ẩn review cập nhật rating,
chính sách hoàn tiền, home luôn pending. Mục tiêu: `npm test` xanh toàn bộ.
