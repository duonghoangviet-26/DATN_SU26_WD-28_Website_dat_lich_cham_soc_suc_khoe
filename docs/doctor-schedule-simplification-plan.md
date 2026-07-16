# Kế hoạch đơn giản hóa & sửa — Lịch làm việc + Xin nghỉ (Prompt 5)

> Ngày: **2026-07-14**. **CHỈ là kế hoạch — CHƯA sửa source code.**
> Dựa trên `doctor-schedule-logic-review.md` và `doctor-schedule-leave-sync-review.md`.
> Nguyên tắc: ưu tiên **không đổi schema** (cờ `bi_khoa_boi_nghi_phep`/`nghi_phep_id`/`trang_thai_ngay`
> **đã có sẵn**); đưa quyết định trạng thái về **backend**; không fake dữ liệu.

## 1. Phần NÊN GIỮ (không đụng)
- Phân quyền bác sĩ (chỉ GET + request-cancel + leaves) và ownership 404 cross-doctor.
- Điều hướng tuần T2–T7, accordion ngày, chi tiết ca join `schedule_id` thật.
- Giữ nguyên dòng thời gian (không bỏ ngày nghỉ trên lịch bác sĩ).
- Cảnh báo GAP-8 ở FE (đến khi dọn Lớp D).
- `findCoveringLeave` + refetch-on-mount (nền tảng đồng bộ FE — sẽ mở rộng, không bỏ).

## 2. Phần NÊN GỘP / đơn giản hóa (chỉ FE, rủi ro thấp)
| Việc | Hiện tại | Đề xuất |
|---|---|---|
| DaySummary + DotBar | 2 khối cùng biểu diễn phân bố status | Giữ **một** (ưu tiên DaySummary chữ), hoặc DotBar chỉ khi mở rộng |
| Badge chồng chất trên header ngày | Nhiều badge không chú thích | Nhóm lại, thêm tooltip/nhãn ngắn |
| Nhãn nghỉ per-slot | Chỉ hiện với slot `active` | Bổ sung **chỉ báo cấp NGÀY** khi ngày có đơn `da_duyet`/`cho_duyet` phủ toàn bộ |

## 3. Phần NÊN CHUYỂN TRANG
| Nội dung | Từ | Đến | Lý do |
|---|---|---|---|
| Danh sách bệnh nhân + trạng thái khám + trạng thái thanh toán (modal chi tiết ca) | Lịch làm việc | Lịch hẹn (`/doctor/appointments`) | Trùng vai trò; chi tiết ca chỉ cần link "Xem trong Lịch hẹn" (đã có sẵn) |
| Tên bệnh nhân trên overview slot | Lịch (overview) | Chi tiết ca / Lịch hẹn | Overview chỉ cần biết ca đã đặt (badge), không cần tên |

## 4. Phần NÊN LOẠI khỏi giao diện bác sĩ
- Không phát hiện chức năng admin lọt vào trang bác sĩ (đã đúng). → **không có gì phải loại**.

## 5. Phần CẦN NÂNG CẤP (bắt buộc — backend là nguồn sự thật)

### 5.1 SYNC-02 (High) — Duyệt nghỉ phải tác động lên lịch làm việc
Khi `approveDoctorLeave`:
- Tìm các `LichLamViec` của bác sĩ trong `[tu_ngay, den_ngay]`.
- **Nghỉ cả ngày** (không gio_*): set `trang_thai_ngay='nghi_phep'`; với slot chưa đặt → `status='locked'` + `bi_khoa_boi_nghi_phep=true` + `nghi_phep_id`.
- **Nghỉ khung giờ**: chỉ khóa slot giao khung giờ (giữ `trang_thai_ngay` nếu còn ca làm việc).
- Slot **đã `booked`**: KHÔNG tự hủy — đánh dấu cần Admin điều phối (giữ nguyên nguyên tắc "không tự hủy lịch hẹn BN"); trả về danh sách lịch hẹn bị ảnh hưởng để Admin xử lý.
- Khi **từ chối/rút sau duyệt**: hoàn tác cờ khóa (mở lại slot `locked` do nghỉ → `active`).
> Dùng cờ **đã có sẵn** trong schema → **không đổi model**.

### 5.2 SYNC-01 (Critical) — Đặt lịch bệnh nhân phải loại ca nghỉ
`getSlots` (patient/booking) hiện chỉ lọc `trang_thai_ngay='lam_viec'` + `status='active'`. Sau 5.1, slot nghỉ sẽ thành `locked` → tự động bị loại. **Bổ sung phòng thủ:** loại slot có `bi_khoa_boi_nghi_phep=true` kể cả khi status lỡ còn `active`. Tùy chính sách: cân nhắc loại cả slot bị đơn `cho_duyet` phủ (nếu chọn Chính sách B).

### 5.3 LEAVE-01 (Medium) — Chống trùng theo khung giờ
`createLeaveRequest` đang chặn ở **mức ngày**. Chuyển sang xét **giao khung giờ** để cho phép nhiều đơn theo ca trong cùng ngày (khớp với nút per-slot ở trang Lịch).

### 5.4 (Nên có) Chỉ báo cấp ngày + nút rút trên trang Lịch
- Hiện nhãn nghỉ cấp ngày; cho phép rút đơn `cho_duyet` ngay tại Lịch (gọi API sẵn có).

## 6. Nâng cấp có thể LÀM SAU (không bắt buộc)
- Refetch khi quay lại tab/trang (visibilitychange) — hiện refetch-on-mount đã đủ cho đồ án.
- Realtime (FCM/socket) — **không cần** trong phạm vi đồ án.
- Snapshot `so_lich_hen_anh_huong`, `loai_nghi` (nghỉ khẩn cấp) — chỉ khi chốt nghiệp vụ (xem gap-analysis C.1/C.2).
- Chuẩn hóa quy ước ngày (TZ-01): thống nhất dùng UTC-explicit ở `schedule.controller` thay `setHours` — giảm phụ thuộc TZ pin.

## 7. GAP-8 (High, DB) — vẫn chờ dọn Lớp D
Không thuộc phạm vi sửa logic này; giữ cảnh báo FE. Cần Admin duyệt script 2 pha (báo cáo → hợp nhất + backup) như mô tả ở `doctor-schedule-database-gap-analysis.md`.

## 8. Thứ tự sửa đề xuất
1. **Chuẩn hóa nguồn trạng thái** (SYNC-02): duyệt/từ chối nghỉ tác động `LichLamViec` (backend).
2. **Chặn đặt lịch** ca nghỉ (SYNC-01): getSlots loại slot bị khóa nghỉ.
3. **Logic ngày/khung giờ nghỉ** (LEAVE-01): chống trùng theo giờ, khóa đúng slot.
4. **Đơn giản hóa FE**: gộp DaySummary/DotBar, chuyển chi tiết BN sang Lịch hẹn, chỉ báo cấp ngày + nút rút.
5. **Nút hành động theo trạng thái**: rà lại ẩn/hiện đúng ma trận (logic-review §4).
6. **Test tích hợp**: chạy ma trận A/B/C (leave-sync review §8).
7. **Review cuối** + cập nhật acceptance report.

## 9. File dự kiến sửa (khi được duyệt)
| Việc | File |
|---|---|
| SYNC-02 | `backend/src/controllers/admin/doctor-leaves.controller.js` (+ service khóa slot) |
| SYNC-01 | `backend/src/controllers/patient/booking.controller.js` (`getSlots`, `createBooking`) |
| LEAVE-01 | `backend/src/controllers/doctor/leaves.controller.js` |
| FE đơn giản hóa / chỉ báo ngày / nút rút | `frontend/src/pages/doctor/DoctorSchedule.tsx`, `utils/scheduleWeek.ts` |
| TZ-01 (tùy chọn) | `backend/src/controllers/doctor/schedule.controller.js` |

## 10. Rủi ro & test cần chạy
- **Rủi ro cao:** thay đổi luồng đặt lịch (SYNC-01) đụng giao dịch `createBooking` (transaction) — phải test double-booking + slot bị khóa nghỉ.
- **Rủi ro trung bình:** khóa/mở slot khi duyệt/từ chối phải idempotent, không đụng slot `booked`.
- **Test bắt buộc:** ma trận A/B/C; hồi quy backend (`npm test`), FE (`vitest`), build, và kiểm chứng động kịch bản A5/B1/B2 trên dữ liệu thật.

> **Xác nhận:** Đây là kế hoạch. Chưa sửa frontend, backend, database; chưa seed, chưa migration, chưa fake dữ liệu.
