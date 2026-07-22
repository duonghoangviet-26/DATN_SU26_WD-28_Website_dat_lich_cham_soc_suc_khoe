# PROMPT 20 — Báo cáo sửa Ca làm việc (Y tá)

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Bước 7. Tạo trang "Ca làm việc" read-only. Không sửa admin schedule.

## Thay đổi

**Backend (mới + mount):**
| File | Loại | Nội dung |
|---|---|---|
| `controllers/nurse/schedule.controller.js` | MỚI | `GET /nurse/schedule?from=&to=` — lọc `LichLamViec.nurse_id = req.user.id`; trả bác sĩ/chuyên khoa/phòng/ngày/giờ ca (min–max slot)/số lịch/`trang_thai_ngay`. CHỈ ĐỌC. |
| `routes/nurse/schedule.routes.js` | MỚI | `GET /` |
| `routes/nurse/index.js` | sửa | mount `/schedule` (đã có guard `verifyToken`+`requireRole('nurse')`) |

**Frontend (mới + sửa):**
| File | Loại | Nội dung |
|---|---|---|
| `pages/nurse/NurseSchedule.tsx` | MỚI | Trang ca: lọc Từ/Đến + nút Tuần trước/này/sau; bảng ngày·giờ ca·bác sĩ·chuyên khoa·phòng·số lịch·trạng thái; nút "Xem bệnh nhân" → `/nurse/queue?date=`; loading/error/empty |
| `types/index.ts` | sửa | thêm `NurseShift` |
| `services/nurse.service.ts` | sửa | thêm `getSchedule({from,to})` |
| `routes/nurseMenu.ts` | sửa | thêm mục "Ca làm việc" |
| `routes/AppRoutes.tsx` | sửa | thêm route `schedule` |
| `pages/nurse/NurseQueue.tsx` | sửa | đọc `date`/`status` từ URL (để "Xem bệnh nhân của ca" + thẻ Dashboard lọc đúng) |

## Đáp ứng yêu cầu
- Chỉ ca của y tá đăng nhập ✅ (`nurse_id` từ token). Không hiển thị ca y tá khác ✅ (probe: y tá khác → 0 ca).
- Hiển thị bác sĩ/phòng/ngày/**giờ ca**/số lịch ✅.
- Lọc ngày/tuần ✅ (Từ/Đến + điều hướng tuần).
- Mở danh sách bệnh nhân của ca ✅ ("Xem bệnh nhân" → `/nurse/queue?date=<ngày ca>`, NurseQueue nay đọc `date`/`status` từ URL).
- **Không** tạo/sửa/xóa/gán ca ✅ (endpoint chỉ đọc, không UI thao tác).
- Xử lý **ca đóng/bác sĩ nghỉ** ✅ (`trang_thai_ngay`: `nghi`→"Nghỉ" xám, `nghi_phep`→"Bác sĩ nghỉ phép" đỏ).
- Xử lý **dữ liệu quan hệ/field thiếu** ✅ (bác sĩ null→"—"; `trang_thai_ngay` thiếu (data cũ) → mặc định `lam_viec` theo default schema).
- loading/error/empty ✅ · Không mock ✅ · Không sửa admin schedule ✅.

## Kiểm thử

- **Backend syntax** `node --check` 3 file → OK.
- **Frontend type-check** → **110 lỗi/3 file = baseline pre-existing**, 0 lỗi mới (NurseSchedule/NurseShift/NurseQueue sạch).
- **Build** `vite build` → ✅ (8.31s).
- **Probe READ-ONLY (dữ liệu thật, không ghi) mô phỏng endpoint:**

| Kịch bản | Kết quả |
|---|---|
| Nhiều ca (07-06→07-20) | **10 ca** hiện đủ (BS. Khang, giờ 08:00–14:30/17:30, phòng "Phòng 102...", số lịch 0–5) ✅ |
| Ca quá khứ | 07-08…07-16 hiển thị bình thường ✅ |
| Ca đóng | 07-16 có 1 ca `nghi` → badge "Nghỉ" ✅ |
| Không có ca | Tuần này (hôm nay+6) → **0 ca** → empty state ✅ |
| Quyền truy cập | Y tá khác (id ngẫu nhiên) → **0 ca** (không thấy ca người khác) ✅ + guard `requireRole('nurse')` + `nurse_id` từ token |

- **Chưa chạy live** (không có test tự động cho endpoint này + cần server); logic đã verify qua probe.

## Rủi ro & ghi nhận
- **Rủi ro thấp.** Endpoint mới chỉ đọc, có guard; FE là trang mới độc lập. `NurseQueue` chỉ thêm đọc URL param (không đổi luồng khác).
- **Anomaly dữ liệu thật (không phải lỗi code, KHÔNG sửa):** 07-14 và 07-16 có **2 bản ghi `LichLamViec` cùng ngày** cho cùng bác sĩ (vi phạm unique `(doctor_id, ngay)` — do `ngay` lệch giờ giữa 2 bản ghi). Endpoint trả trung thực cả hai. Ghi nhận vào mục dữ liệu cần dọn (kế hoạch DB riêng).
- **Filter status trên NurseQueue:** option select hiện thiếu `waiting_record`/`skipped` → thẻ Dashboard "Chờ nhập hồ sơ" (status=waiting_record) lọc đúng dữ liệu nhưng select hiển thị trống → hoàn thiện ở Bước 8.

## Vấn đề còn tồn
- Bổ sung option `waiting_record`/`skipped` + cột "Hồ sơ" + tìm kiếm cho NurseQueue → Bước 8.
- Dọn dữ liệu `LichLamViec` trùng ngày → kế hoạch DB riêng.
- Full UI test end-to-end chờ server + seed hôm nay (Bước 17).
