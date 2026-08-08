# Triển khai mục 3 — Bác sĩ đăng ký theo CA — 2026-07-26

Tiếp nối `docs/Trien khai L14 + rang buoc slot (2026-07-26).md`.
Rule: `.claude/rules/lich-lam-viec-bac-si.md` mục 3 + 10.B/10.C.

---

## 1. Vấn đề

`scheduleGenerator` sinh lịch **full-day cho MỌI bác sĩ đang hoạt động, cả 7 ngày trong tuần**. Sai nghiệp vụ: bác sĩ ViteFamily không full-time, họ đăng ký theo **ca**. Hậu quả: bệnh nhân thấy chỗ trống ở những ca thực tế không có ai trực.

---

## 2. Quyết định kiến trúc quan trọng — đặt ràng buộc ở ĐÂU

Rule §10.C ban đầu ghi: đổi unique `(doctor_id, ngay)` → `(doctor_id, ngay, ca)` trên `lich_lam_viec`, thêm unique `(phong_id, ngay, ca)`.

Khảo sát trước khi sửa cho thấy điều đó là **đại phẫu**. Đổi như vậy nghĩa là mỗi ngày sinh ra **2 bản ghi** thay vì 1, trong khi có **9 chỗ** đang giả định "1 lịch / bác sĩ / ngày":

| File | Dòng | Cách dùng |
|---|---|---|
| `services/scheduleGenerator.service.js` | 167 | kiểm tra tồn tại |
| `controllers/doctor/queue.controller.js` | 81, 162 | lịch hôm nay của bác sĩ |
| `controllers/doctor/stats.controller.js` | 98 | lịch hôm nay |
| `controllers/doctor/room-status.controller.js` | 42 | lịch hôm nay |
| `controllers/admin/slots.controller.js` | 425 | kiểm tra tồn tại |
| `controllers/patient/booking.controller.js` | ~226 | lịch của ngày được chọn |
| `controllers/receptionist/booking.controller.js` | ~131 | lịch của ngày được chọn |
| `scripts/seed-doctor-test-data.js` | 117 | tìm/tạo lịch |

Tất cả sẽ **chỉ thấy một nửa lịch**. Cộng thêm việc phải map lại `schedule_id` của các `LichHen` cũ. Rủi ro rất cao, và đúng thứ mục 7 dặn tránh: *"KHÔNG đại phẫu tách collection trừ khi được yêu cầu."*

### Cách giải quyết

**Đặt ràng buộc ở `mau_lich_lam_viec`, không ở `lich_lam_viec`.**

Mẫu là **nguồn đăng ký**; lịch làm việc chỉ là **hệ quả** được sinh ra từ mẫu. Chặn ở nguồn thì lịch sinh ra không bao giờ vi phạm được — mà không phải động vào cấu trúc `lich_lam_viec`.

- `1 phòng = 1 bác sĩ / ca` → không cho hai mẫu active cùng `(thu_trong_tuan, ca, phong_id)`
- `1 bác sĩ = 1 phòng / ca` → không cho hai mẫu active cùng `(thu_trong_tuan, ca, bac_si_id)`

`phong_id` được đặt ở cấp **SLOT** của `lich_lam_viec`, không phải cấp lịch — vì phòng gắn với **CA**: bác sĩ có thể sáng phòng 101, chiều phòng 102, cấp lịch không diễn tả được điều đó.

Rule §10.C đã được cập nhật ghi lại quyết định này kèm lý do.

### Vì sao kiểm chồng lấn phải ở service

Unique index **không** diễn tả được "trùng khoá nhưng khác khoảng hiệu lực". Hai mẫu cùng `(thứ, ca, phòng)` mà `hieu_luc_tu`/`hieu_luc_den` rời nhau là **hợp lệ** (ví dụ đổi phòng từ tháng sau). Nên ràng buộc nằm ở `timMauXungDot()` trong model, gọi từ mọi đường ghi — cùng cách `NghiPhepBacSi` chặn trùng đơn nghỉ.

---

## 3. Đã làm

| File | Thay đổi |
|---|---|
| `models/MauLichLamViec.js` | **MỚI** — schema + `caCuaKhung()` + `timMauXungDot()` + `haiKhoangGiaoNhau()` |
| `models/LichLamViec.js` | Slot thêm `phong_id` (ref PhongKham) |
| `models/index.js` | Export `MauLichLamViec` |
| `services/scheduleGenerator.service.js` | `docMauChoNgay()` mới; `buildDefaultScheduleSlots` nhận `caLamViec`/`phongTheoCa`; `generateSlotsForDoctorDate` **không còn auto full-day**; thống kê thêm `khong_dang_ky_ca` |
| `controllers/admin/schedule-templates.controller.js` | **MỚI** — list / grid / create / bulk / update / remove |
| `routes/admin/schedule-templates.routes.js` | **MỚI** — mount `/api/admin/schedule-templates` |
| `controllers/admin/slots.controller.js` | `ensureDoctorWorkday` đọc mẫu để đường thủ công không lệch với cron |
| `scripts/migrations/011-seed-mau-lich-lam-viec.js` | **MỚI** — seed mẫu giữ nguyên hành vi cũ |
| `frontend/.../ManageShiftTemplates.tsx` | **MỚI** — trang "Lịch trực tuần" |
| `frontend/src/services/schedule-template.service.ts` | **MỚI** |
| `frontend/src/routes/{AppRoutes,adminMenu}` | Thêm route + mục menu |

### Ba chi tiết thiết kế đáng ghi

**Xóa mềm mẫu.** Bỏ một ca chỉ chuyển `trang_thai='inactive'`, không xóa cứng — lịch đã sinh ra từ mẫu đó vẫn còn, xóa cứng sẽ làm mất dấu vết vì sao ngày đó có lịch.

**`bulkCreate` là tất-cả-hoặc-không.** Kiểm toàn bộ trước khi ghi bản ghi nào. Xếp được một nửa rồi báo lỗi là trạng thái khó hiểu nhất cho admin.

**Thông báo xung đột nói bằng tiếng người.** Không trả "trùng khoá" mà trả:
> *Không xếp được ca này. Thứ 2 Ca sáng: phòng đã do BS. Lê Quốc Bảo trực; Thứ 2 Ca sáng: bác sĩ này đã được xếp một phòng khác.*

---

## 4. Chuyển đổi an toàn

Nếu bật generator theo mẫu mà chưa seed, **mọi bác sĩ hiện có thành "chưa đăng ký ca nào"** → hệ thống ngừng sinh lịch mới. Migration `011` seed đúng hành vi cũ (7 thứ × 2 ca, phòng mặc định của bác sĩ) để không ai mất lịch; admin trim lại trên giao diện.

Migration **không** tạo dữ liệu vi phạm: nếu hai bác sĩ dùng chung phòng mặc định, nó bỏ qua bác sĩ thứ hai và **báo cáo** thay vì seed ra xung đột. Đã kiểm chứng trên DB test (5 bác sĩ, 2 người trùng phòng → seed 4, cảnh báo 1).

---

## 5. Kiểm chứng

### Trên DB test riêng (`DATN_VITAFAMILY_CLAUDE_TEST`, backend :5199)

```
Sinh lịch tuần 2027-06-07:
  bác sĩ           : 5
  đã sinh          : 28      (4 bác sĩ có mẫu × 7 ngày)
  không đăng ký ca : 7       (bác sĩ thứ 5 → không sinh lịch nào)

Ví dụ lịch: 30 slot — ca sáng 14, ca chiều 16
  phong_id gắn vào slot: CÓ ✓   phong_kham="Phòng 101, Tầng 1, Tòa A"

Sau khi bỏ ca chiều của một bác sĩ:
  ca đăng ký còn lại: [sang]
  lịch sinh ra      : 14 slot   (ca sáng 14, ca chiều 0 ✓)

Bác sĩ không còn mẫu active → lịch không được tạo ✓
```

### Test suite

58/58 pass (`doctor.api`, `doctor.schedule`, `doctor.leave-sync`, `ketquakham-sinhhieu`, `admin.medical-read`, `doctor.confirm-result`). Frontend `tsc --noEmit`: không lỗi trong file mới.

### Trên DB nhóm (`DATN_VITAFAMILY`, backend :5000)

Migration `011`: 42 mẫu cho 3 bác sĩ, không xung đột (3 bác sĩ / 3 phòng riêng).

API thật, thử vi phạm ràng buộc:

```
GET /admin/schedule-templates/grid -> 200
  bác sĩ 3 · phòng 3 · chưa xếp ca 0

Thử xếp BS. Trần Minh Khang vào phòng của BS. Lê Quốc Bảo (Thứ 2 ca sáng):
  -> 409 ✓ ĐÃ CHẶN
```

---

## 6. Ảnh hưởng sang khu vực thành viên khác

| Khu vực | Mức độ |
|---|---|
| **Admin** | Thêm trang "Lịch trực tuần" + API mới. `slots.controller.ensureDoctorWorkday` nay đọc mẫu — bác sĩ có mẫu thì tạo đúng ca đã xếp, bác sĩ chưa có mẫu vẫn tạo full-day (cửa thoát có chủ đích) |
| **Client · Lễ tân · Bác sĩ** | **Không đổi code.** Nhưng đổi **dữ liệu**: ca không có ai trực sẽ không còn slot. Sau migration `011` hành vi giữ nguyên (mẫu = full-week), chỉ thay đổi khi admin bắt đầu trim lịch trực |
| **Dùng chung** | `scheduleGenerator` — mọi nơi gọi generator nay phụ thuộc mẫu |

⚠️ Điểm cần cả nhóm biết: **duyệt bác sĩ mới không còn tự động có lịch.** `generateInitialWindowForDoctor` sẽ trả `khong_dang_ky_ca > 0` cho tới khi admin xếp ca. Đây đúng rule §3 nhưng khác kỳ vọng cũ.

---

## 7. Chưa làm

- Bác sĩ **tự xem/đề xuất** lịch trực của mình (hiện chỉ admin xếp)
- `hieu_luc_tu`/`hieu_luc_den` chưa có trên giao diện — API hỗ trợ đầy đủ, form hiện luôn dùng "từ hôm nay, vô thời hạn"
- Cảnh báo khi admin bỏ ca mà ngày tương lai **đã có lịch hẹn** ở ca đó
- 73 lịch làm việc mồ côi (2 `doctor_id` không còn trong `bac_si`, không có lịch hẹn nào)
- Các mục còn lại của rule: §6 (ưu tiên động, aging, overflow), §11 (cutoff `T-30'`), §12 (tự gán bác sĩ), §13 (chặn lễ tân đặt hộ), §14/§15 (bác sĩ nghỉ / bận một khung)
