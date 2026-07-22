# PROMPT 18 — Báo cáo sửa API lấy dữ liệu đúng theo y tá đăng nhập

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Bước 3 (scope theo CA). Chỉ backend + service — không sửa giao diện lớn.

## Phát hiện chỉnh hướng (quan trọng)
Test `tests/nurse.createdraft-appointment.test.js:61-67` **khẳng định** `createDraft` với `appointment_id` **không có HangDoi → 409**. Nghĩa là ràng buộc HangDoi trong `createDraft` là **THIẾT KẾ CỐ Ý, đã khóa bằng test** — KHÔNG phải "regression". → **Bước 4 (decouple createDraft) trong kế hoạch bị VÔ HIỆU** (sẽ phá test + phá thiết kế check-in→HangDoi). Đường đúng để nhập hồ sơ là **nối check-in (QĐ-2)**, không phải decouple. (7/7 hồ sơ appointment-only trong DB là **dữ liệu cũ** trước thiết kế này.)

## Thay đổi đã thực hiện

Đổi phạm vi dữ liệu của **danh sách + chi tiết + dashboard** từ `LichHen.nurse_id` (không được gán lúc đặt) sang **CA** (`LichLamViec.nurse_id → doctor_ids`), nhất quán với `medical-records`/`queue` và khớp test `nurse-doctor-status-sync`.

| File sửa | Thay đổi | Lý do |
|---|---|---|
| `backend/src/utils/nurse-scope.js` | Thêm `getMyDoctorIdsOnDate(nurseId, date)` | Tổng quát scope theo ca cho ngày bất kỳ |
| `backend/src/controllers/nurse/appointments.controller.js` | `listQueue`: filter `doctor_id ∈ getMyDoctorIdsOnDate(...)` thay `nurse_id`; ca rỗng → `[]`. `getById`: kiểm scope RẺ trước (doctor∈ca theo ngày lịch) rồi mới tải PII; ngoài ca → 404. Cập nhật comment. | Lọc theo phân công thực tế; không lộ PII ngoài phạm vi |
| `backend/src/controllers/nurse/dashboard.controller.js` | `apptsToday`: filter `doctor_id ∈ doctorIdsToday` (từ `scheduleToday`) thay `nurse_id` | Nhất quán scope theo ca |

**KHÔNG đụng:** logic hồ sơ khám, `createDraft`/HangDoi, admin/doctor/patient, database schema, giao diện.

## Đáp ứng yêu cầu prompt
- **Danh tính từ token:** ✅ `req.user.id` (không nhận nurseId từ FE — đã có sẵn, giữ nguyên).
- **Kiểm role:** ✅ `requireRole('nurse')` ở middleware (không đổi).
- **Nurse profile tồn tại:** y tá = `NguoiDung role=nurse` (không có model profile riêng); token+guard đảm bảo tồn tại; không ca → trả rỗng an toàn.
- **Lọc theo quan hệ phân công thật:** ✅ `LichLamViec.nurse_id` (ca).
- **Không tin ID từ FE / không trả toàn hệ thống rồi lọc FE:** ✅ lọc tại DB theo doctor_ids.
- **Không trả PII thừa:** ✅ `getById` kiểm phạm vi TRƯỚC khi populate member.
- **Response nhất quán:** ✅ giữ nguyên envelope + shape mảng (KHÔNG đổi sang {items,...} để không phá FE — **pagination hoãn**, cần đổi FE phối hợp, ngoài phạm vi bước này).
- **Edge cases:** không ca → `[]`/404; không lịch → `[]`; phân công không hợp lệ → chỉ lấy doctor_ids hợp lệ từ ca; thiếu quan hệ populate → fallback `'—'` (sẵn có).

## Kiểm thử

**Cú pháp:** `node --check` cả 3 file → OK.

**Verify logic scope (probe READ-ONLY trên dữ liệu thật, không ghi DB):**
| Kịch bản | Kết quả |
|---|---|
| Y tá A không xem dữ liệu y tá B | Ngày mẫu 07-08: ca y tá = 1 bác sĩ → **1 lịch trong scope**; tổng ngày = 3; **2 lịch bác sĩ khác BỊ LOẠI** ✅. Cơ chế: scope = bác sĩ từ `LichLamViec.nurse_id = chính y tá đó` → y tá khác (token khác) ra tập khác |
| Dữ liệu rỗng | Hôm nay y tá 0 ca → `listQueue` trả `[]` ✅ |
| Thay ID URL / request trực tiếp | `getById` kiểm doctor∈ca theo ngày lịch TRƯỚC khi trả → lịch ngoài ca → 404 (logic đã kiểm) |

**Tương thích test sẵn có:** `nurse-doctor-status-sync.test.js` (dòng 109-111) kỳ vọng nurse xem được `/nurse/appointments/:id` của bác sĩ mình trực → ca-based **thỏa** (test vốn đã yêu cầu nurse có ca với bác sĩ đó, xác nhận ở dòng 137-142). Thay đổi **khớp thiết kế test**.

**Chưa chạy được (ghi rõ):** bộ integration test `node --test` cần **server chạy + seed hôm nay** (TEST_TODAY_APT_01/03 + ca y tá hôm nay). Hiện y tá **0 ca hôm nay** → cần Bước 17 (seed) mới chạy full suite. Không tự seed (ghi DB) trong bước này.

## Rủi ro
- **Thấp–trung bình.** Đổi tập dữ liệu hiển thị: nay theo ca thay vì `nurse_id`. Với dữ liệu thật, ca-based cho kết quả đúng phạm vi (đã verify subset). Không đổi schema/response shape.
- Lưu ý vận hành: **y tá chỉ thấy dữ liệu khi được gán ca** (`LichLamViec.nurse_id`) — hôm nay chưa gán nên rỗng (đúng nghiệp vụ). Việc gán ca là chức năng admin còn thiếu (đã ghi nhận ở PROMPT 7, ngoài phạm vi nurse).

## Vấn đề còn tồn
- Pagination hoãn (cần phối hợp FE).
- Full integration test chờ seed hôm nay (Bước 17).
- **Bước 4 (decouple createDraft) huỷ** — thay bằng cân nhắc QĐ-2 (nối check-in) để mở luồng nhập hồ sơ.
