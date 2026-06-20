# VitaFamily — 20 Chức Năng

> Tóm tắt nhanh để AI và thành viên nắm được luồng xử lý.
> Chi tiết đầy đủ: `Tài liệu dự án/Chức Năng Chính/[tên].pdf`

---

## NHÓM A — Bệnh nhân (7 chức năng)

### A1 — Đăng ký & Đăng nhập

- Đăng ký tài khoản (role mặc định = `user`)
- Đăng nhập → hệ thống nhận ra role và chuyển trang phù hợp
- Quên mật khẩu → gửi OTP 6 số về email → đặt lại mật khẩu (OTP hết hạn 15 phút)
- **Bảng liên quan:** `users`, `password_resets`

### A2 — Quản lý hồ sơ gia đình

- 1 tài khoản → 1 nhóm gia đình → tối đa 10 thành viên
- Mỗi thành viên: tên, ngày sinh, giới tính, nhóm máu, dị ứng, bệnh nền
- Thành viên "chủ hộ" (`la_chu_ho = 1`) không xóa được
- Xóa thành viên = soft delete (giữ lại hồ sơ y tế cũ)
- **Bảng liên quan:** `families`, `members`

### A3 — Xem hồ sơ khám bệnh

- Lịch sử khám của từng thành viên: ngày, bệnh viện, bác sĩ, chẩn đoán
- 2 nguồn: `tu_kham` (tự động sau khi bác sĩ ghi kết quả) và `thu_cong` (bệnh nhân tự nhập)
- Hồ sơ `tu_kham` không sửa/xóa được bởi bệnh nhân
- **Bảng liên quan:** `medical_records`

### A4 — Quản lý đơn thuốc & nhắc uống thuốc

- Đơn thuốc có thể do bác sĩ kê (sau B4) hoặc bệnh nhân tự nhập
- Hệ thống tạo lịch nhắc theo giờ uống (JSON array `gio_uong`)
- Cron job chạy mỗi 5 phút: `pending` → `sent` (gửi email); `sent` quá 2 tiếng → `missed`
- Bệnh nhân xác nhận "Đã uống": `sent` → `taken`
- Tối đa 10 loại thuốc/đơn, tối đa 90 ngày/đơn
- **Bảng liên quan:** `prescriptions`, `prescription_items`, `reminders`

### A5 — Đặt lịch khám

- 2 hình thức: `clinic` (tại viện) · `home` (bác sĩ đến nhà) _(video đã bỏ)_
- Luồng clinic: Chọn chuyên khoa → Chọn bác sĩ → Xem slot còn trống (đã có phòng) → Chọn giờ → Thanh toán
- Luồng home: Chọn bác sĩ → Chọn slot → Nhập địa chỉ → Thanh toán → **Bác sĩ confirm thủ công**
- Có thể đặt cho bản thân hoặc thành viên gia đình
- Appointment `unpaid` quá 15 phút → cron job tự hủy (đọc `thoi_gian_het_han_thanh_toan` từ `payment_settings`)
- `gia_kham` = snapshot `service.gia` lúc đặt (không đổi khi admin thay đổi giá sau)
- Bệnh nhân chỉ thấy slot `status='active'` và có `phong_kham` (clinic) hoặc `status='active'` (home)
- **Bảng liên quan:** `lich_hen`, `lich_lam_viec` (embed `slots[]`), `thanh_toan`

### A6 — Chatbot tư vấn sức khỏe (AI)

- Trả lời câu hỏi sức khỏe bằng tiếng Việt qua Google Gemini
- Chỉ tư vấn thông tin chung, không chẩn đoán/kê đơn
- Session tự đóng sau 24h không hoạt động
- **Bảng liên quan:** `chat_sessions`, `chat_messages`

### A7 — Xem thông báo

- Badge đỏ hiển thị số thông báo chưa đọc
- 3 loại: `appointment` · `medicine` · `system`
- Thông báo đã đọc tự xóa sau 90 ngày (cron)
- **Bảng liên quan:** `notifications`

---

## NHÓM B — Bác sĩ (5 chức năng)

### B1 — Quản lý hồ sơ bác sĩ

- Đăng ký → nộp hồ sơ (`pending`) → Admin duyệt (`approved`) hoặc từ chối (`rejected`)
- Tối đa nộp lại 5 lần; sau 5 lần từ chối → `rejected_final` (không nộp lại được)
- Khi duyệt: `doctors.trang_thai_duyet='approved'` + `doctors.la_hien=true` + `users.role='doctor'` (1 transaction)
- Bác sĩ bị từ chối nhận email kèm lý do; lịch sử từ chối lưu trong `lich_su_tu_choi[]`
- Bác sĩ tự chọn chuyên khoa (`specialties[]`) và dịch vụ (`services[]`) mình cung cấp
- VitaFamily là phòng khám tư 1 cơ sở — bác sĩ không gắn với bệnh viện nào cả
- **Bảng liên quan:** `bac_si` (embed `specialties[]`, `services[]`), `nguoi_dung`

### B2 — Quản lý lịch làm việc

- Bác sĩ tạo slot khám (`slots[]` embed trong `lich_lam_viec`) cho từng ngày
- **1 slot = 1 bệnh nhân** — khi đặt xong, slot chuyển `active → booked` (atomic update)
- Bác sĩ cần điền `phong_kham` — slot chưa có phòng sẽ không hiển thị cho bệnh nhân đặt
- Slot đã `booked` không được xóa/sửa giờ — phải qua Admin để xử lý hoàn tiền
- Cron hàng ngày: slot `active` quá ngày → `expired`
- **Bảng liên quan:** `lich_lam_viec` (embed `slots[]`)

### B3 — Xác nhận & quản lý lịch hẹn

- Xem danh sách lịch hẹn → xác nhận hoặc từ chối (kèm lý do)
- Xem trước hồ sơ bệnh nhân trước khi khám (dị ứng, bệnh nền, lịch sử)
- Sau khám → đánh dấu `completed` → chuyển sang B4
- **Bảng liên quan:** `appointments`

### B4 — Ghi kết quả khám & kê đơn thuốc

- Ghi: chẩn đoán, hướng dẫn điều trị, ngày tái khám
- Có thể sửa trong 24h đầu (`co_the_sua = 1`); sau 24h bị khóa
- Kê đơn → hệ thống tự tạo `medical_record` cho bệnh nhân và `reminders` nhắc thuốc
- **Bảng liên quan:** `examination_results`, `prescriptions`, `prescription_items`

### B5 — Xem thống kê cá nhân & đánh giá

- Số ca khám, tỉ lệ hoàn thành/hủy, điểm đánh giá trung bình, toàn bộ nhận xét
- `diem_danh_gia` tự cập nhật khi review bị ẩn/xóa
- Không thấy đánh giá có `status = 'hidden'`
- **Bảng liên quan:** `reviews`, `doctors`

---

## NHÓM C — Admin (8 chức năng)

### C1 — Quản lý người dùng ✅ (đã có trang mẫu)

- Xem/tìm kiếm/lọc tài khoản theo vai trò, trạng thái
- Khóa/mở khóa tài khoản (kèm lý do)
- Không khóa được tài khoản `admin`
- **Bảng liên quan:** `users`, `audit_logs`

### C2 — Duyệt hồ sơ bác sĩ

- Nhận thông báo khi bác sĩ nộp → xem xét → duyệt hoặc từ chối
- Duyệt: `doctors.trang_thai_duyet = 'approved'` + `users.role = 'doctor'` (1 transaction)
- Từ chối: ghi lý do, bác sĩ nhận email, có thể nộp lại (tối đa 5 lần)
- **Bảng liên quan:** `doctors`, `users`, `audit_logs`

### C3 — Quản lý chuyên khoa

- CRUD chuyên khoa _(VitaFamily là phòng khám tư 1 cơ sở — không quản lý nhiều bệnh viện)_
- Ẩn thay vì xóa (`status = 'hidden'`) để không ảnh hưởng bác sĩ/dịch vụ đã gắn
- Slug tự sinh từ tên (URL-friendly), bất biến sau khi tạo
- **Bảng liên quan:** `chuyen_khoa`

### C4 — Quản lý dịch vụ

- CRUD gói dịch vụ (đặc biệt là khám tại nhà)
- Bật/tắt dịch vụ; dịch vụ tắt ẩn khỏi trang đặt lịch
- **Bảng liên quan:** `services`

### C5 — Quản lý lịch hẹn toàn hệ thống

- Xem/lọc tất cả lịch hẹn (ngày, bác sĩ, trạng thái, loại khám)
- Hủy khẩn cấp hoặc chuyển sang bác sĩ khác → hệ thống tự thông báo bệnh nhân
- **Bảng liên quan:** `appointments`, `audit_logs`

### C6 — Quản lý đánh giá & phản hồi

- Xem đánh giá, chú ý 1–2 sao
- Ẩn hoặc xóa đánh giá vi phạm
- Ẩn đánh giá → tự cập nhật `diem_danh_gia` của bác sĩ
- **Bảng liên quan:** `reviews`, `audit_logs`

### C7 — Gửi thông báo hệ thống

- Soạn → chọn đối tượng (`tat_ca` / `benh_nhan` / `bac_si`) → xem trước → gửi ngay
- Batch insert 100 records/lần tránh quá tải
- Không thu hồi sau khi gửi
- **Bảng liên quan:** `system_notifications`, `notifications`

### C8 — Quản lý thanh toán

- **Thanh toán mock** (VitaPay): bệnh nhân thanh toán khi đặt lịch
- **Hoàn tiền:** tự tính % theo chính sách thời gian; Admin duyệt/từ chối
- Chính sách hoàn tiền lấy từ bảng `payment_settings` (không hardcode)
- **Bảng liên quan:** `payments`, `refunds`, `payment_settings`

---

## Chính sách hoàn tiền

| Thời gian hủy trước lịch khám | Hoàn                    |
| ----------------------------- | ----------------------- |
| ≥ 24 giờ                      | 100%                    |
| 12 – 24 giờ                   | 80%                     |
| 6 – 12 giờ                    | 50%                     |
| < 6 giờ                       | 0%                      |
| Bác sĩ chủ động hủy           | 100% (bất kể thời gian) |
