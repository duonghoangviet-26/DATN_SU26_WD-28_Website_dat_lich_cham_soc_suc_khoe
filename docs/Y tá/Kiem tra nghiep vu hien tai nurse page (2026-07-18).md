# PROMPT 3 — Kiểm tra nghiệp vụ hiện tại của nurse page

> Ngày: 2026-07-18 · Chỉ đọc code + dữ liệu thật (probe read-only, che PII). Không sửa.
> Lần theo code/API, KHÔNG kết luận theo tên nút/tên file.

## Bảng đối chiếu chức năng

| Chức năng | Hiện trạng (lần theo code) | Dữ liệu | Đúng nghiệp vụ? | Lỗi | Mức | Đề xuất |
|---|---|---|---|---|---|---|
| **Dashboard** | Route ✅ role ✅. `getDashboard` (thật). Lọc `nurse_id`(token)+`LichLamViec.nurse_id`+`KetQuaKham.nguoi_nhap_id`. Có loading/error/empty. | Thật | Phần đếm hồ sơ đúng; phần đếm lịch hẹn **rỗng vì booking không set nurse_id** | Số lịch hẹn = 0 hôm nay | **P0** | Set `nurse_id` khi đặt lịch |
| **Ca được phân công** | Hiển thị trong Dashboard (`bac_si_ho_tro` từ `LichLamViec.nurse_id`). Không có trang riêng. | Thật | Đúng (chỉ xem) | Chỉ có data cho 1 bác sĩ (backfill); 0 hôm nay | P0 (hệ quả) | Như trên |
| **Lịch hẹn (NurseQueue)** | Route ✅ role ✅. `getQueue`→`/nurse/appointments`, gate `LichHen.nurse_id`. Nút "Xem chi tiết" = điều hướng (không API). Có loading/error/empty. | Thật | Đúng phạm vi (nurse_id, không lộ ngoài ca) | Rỗng hôm nay; sắp theo `gio_kham` không phải thứ tự hàng đợi thật (controller tự ghi chú) | **P0** | Set nurse_id; (sau) chốt nguồn hàng đợi |
| **Chi tiết lịch hẹn (xem)** | `getById` gate `nurse_id`. Hiện thông tin bệnh nhân + `di_ung`/`benh_nen` tô màu cảnh báo. Loading/error ✅. | Thật | Đúng | Phụ thuộc nurse_id | P0 (hệ quả) | Như trên |
| **Tiếp nhận bệnh nhân** | Backend `queue.controller` (checkin/call/into-room) + service có, **nhưng KHÔNG page/nút nào gọi**. | — | Thiếu hẳn trong UI | Chức năng không dùng được từ trang y tá | **P2** | Chốt kiến trúc: nối hoặc gỡ |
| **Ghi nhận ban đầu (sinh hiệu)** | Form trong `NurseAppointmentDetail` (HA/mạch/nhiệt độ/cân nặng/chiều cao/triệu chứng/ghi chú ĐD). Lưu qua `createDraft`/`update` (`sinh_hieu`). | Thật | Đúng vai trò y tá | **Bị chặn cùng createDraft (409)** khi không có HangDoi | **P0** | Decouple createDraft |
| **Hồ sơ cần nhập** | Không trang riêng — là form chi tiết, vào từ hàng đợi. | Thật | Chấp nhận | — | P3 | Có thể thêm bộ lọc |
| **Tạo hồ sơ / Lưu nháp** | `createDraft` (thật). **Bắt buộc resolve `HangDoi` theo appointment_id → 409 nếu không có.** Dữ liệu thật: **7/7 hồ sơ có appointment_id, 0 hang_doi_id** ⇒ code hiện tại KHÔNG thể tạo ra chúng → regression. | Thật | **Sai** — chặn nghiệp vụ nhập hồ sơ chuẩn | 409 "chưa check-in vào hàng đợi" | **P0** | Cho tạo hồ sơ neo `appointment_id` |
| **Gửi bác sĩ xác nhận** | `submit`: `KetQuaKham='cho_xac_nhan'` + `LichHen='waiting_doctor_confirm'`. Có toast, reload. | Thật | Đúng + **đồng bộ bác sĩ đúng** | Bị chặn phía trên (cần có nháp trước) | P1 (phụ thuộc) | Giải P0.2 là chạy |
| **Nhận yêu cầu sửa (NurseRevisions)** | `getRevisions` (thật). **Response KHÔNG trả `appointment_id`** (chỉ `hang_doi_id`); FE điều hướng `/nurse/appointments/${appointment_id}` → `undefined`. Hiện DB **0 hồ sơ yeu_cau_chinh_sua** → trang rỗng. | Thật | **Sai** ở nút điều hướng | Nút "Chỉnh sửa hồ sơ" hỏng (lỗi tiềm ẩn tới khi có revision) | **P1** | Trả `appointment_id` + sửa type |
| **Sửa & gửi lại** | `update` + `resubmit` (thật). Chỉ khi `ban_nhap`/`yeu_cau_chinh_sua`. | Thật | Đúng | Lối vào từ Revisions hỏng (P1.1); vào từ queue vẫn được | P1 | Giải P1.1 |
| **Hồ sơ đã xác nhận** | Chi tiết khóa form khi `da_xac_nhan` (badge xanh, `isEditable=false`). DB có 4 `da_xac_nhan`. | Thật | **Đúng** — khóa sau xác nhận | — | ✅ OK | Giữ nguyên |
| **Profile** | **Không tồn tại** (không route/menu/page). | — | Thiếu | Không có trang cá nhân | P2/P3 | Bổ sung tối giản |

## Kiểm tra vượt quyền
- Thanh toán: hiển thị **chỉ xem**, **không có API** cho y tá đổi `payment_status`. ✅ đúng.
- Không có endpoint nurse nào đổi bác sĩ/dịch vụ/giá/phòng/lịch. ✅
- `da_xac_nhan` chỉ do bác sĩ (endpoint doctor) — y tá không tự set. ✅
- **Kết luận: KHÔNG phát hiện hành động vượt quyền trong controller nurse.** (Điểm tốt.)

## Kết luận

**Đã hoàn thành thật:**
- Gửi bác sĩ xác nhận + đồng bộ `LichHen`/`KetQuaKham` (đúng, có dữ liệu 4 `da_xac_nhan`, 6 `nguoi_xac_nhan_id`).
- Khóa hồ sơ sau xác nhận (đúng nghiệp vụ).
- Xem chi tiết bệnh nhân + cảnh báo dị ứng/bệnh nền.
- Đếm hồ sơ ở Dashboard (theo `nguoi_nhap_id`).

**Chỉ có giao diện (backend chưa nối UI):**
- Tiếp nhận/gọi/vào phòng/trạng thái phòng (hệ HangDoi + room-status).

**Có API nhưng chưa hoạt động đúng:**
- `Lưu nháp/Tạo hồ sơ` — 409 do bắt buộc HangDoi (P0.2).
- `NurseRevisions` nút Chỉnh sửa — điều hướng undefined (P1.1).
- `queue`/`room-status` — không component gọi.

**Sai nghiệp vụ:**
- createDraft ép HangDoi (không khớp dữ liệu thật appointment-only).
- Hai gate song song trên cùng màn hình (xem: nurse_id; lưu: HangDoi).

**Sai phân quyền:** không có (guard 2 lớp + lọc theo token đều đúng).

**Cần làm trước (thứ tự):**
1. **P0.1** Set `LichHen.nurse_id` khi đặt lịch → mọi trang có dữ liệu.
2. **P0.2** Decouple `createDraft` khỏi HangDoi → Lưu nháp chạy.
3. **P1.1** Trả `appointment_id` ở `listRevisions` + sửa type → nút Chỉnh sửa chạy.
4. **P1.2** Thống nhất gate xem & lưu (hệ quả của P0.2).
5. (Sau) P2: chốt hệ hàng đợi (nối/gỡ), thêm Profile.
