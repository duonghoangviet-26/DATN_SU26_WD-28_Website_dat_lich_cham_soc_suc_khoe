# Trang Điều phối bác sĩ — triển khai (2026-08-23)

> Thiết kế: `docs/superpowers/specs/2026-08-23-trang-dieu-phoi-bac-si-design.md` (local-only)
> Phân tích lỗ hổng: `docs/Phan tich lo hong trang Dieu phoi bac si (2026-08-23).md`

## 1 · Đã sửa

| Mã | Lỗi | Cách sửa | File |
|---|---|---|---|
| P0-1 | Nhả slot cũ trước khi tìm slot mới | Xoá hẳn `bulkRescheduleAppointments` | `receptionist/appointment.controller.js` |
| P0-2 | `bulkReschedule` crash 100% (`MauLichLamViec.ca_kham` không tồn tại) | Xoá hẳn | như trên |
| P0-3 | `locked` mang 3 nghĩa, chiếm nhầm slot bác sĩ nghỉ | `rescheduleRules.js` + vá 3 chỗ (khoá / sinh lại / chiếm) | `rescheduleRules.js`, `appointmentReschedule.service.js`, `doctorLeaveApproval.service.js` |
| P0-4 | Khách tự dời cũng khoá slot cũ vĩnh viễn | `khoaSlotCu` trong `apDungPhuongAn` | `appointmentReschedule.service.js` |
| P1-6 | `!de_xuat_doi` chặn cả đề xuất còn mở | `nenSinhLaiDeXuat()` | `rescheduleRules.js` |
| P1-7 | `slice(0,6)` trước khi gộp trùng → còn 1 phương án | Đảo thứ tự gộp/cắt | `appointmentReschedule.service.js` |

## 2 · Đã thêm

| Chức năng | Endpoint / Route | File chính |
|---|---|---|
| Khôi phục báo nghỉ | `GET /api/receptionist/doctor-leaves/:id/huy-bao-nghi/preview`<br>`PATCH /api/receptionist/doctor-leaves/:id/huy-bao-nghi` | `services/doctorLeaveRestore.service.js`, `components/receptionist/ConfirmRestoreModal.tsx` |
| Tìm phương án 7 ngày | — | `services/rescheduleRules.js`, `services/appointmentReschedule.service.js` |
| Sinh lại phương án khi mất chỗ giữ sẵn | — | `sinhLaiDeXuatChoLichMatCho()` |
| Danh sách đơn nghỉ còn việc | `GET .../reschedule-approvals/leaves` | `pages/receptionist/DanhSachDieuPhoi.tsx` |
| Bảng điều phối một đơn | `GET .../reschedule-approvals/leave/:leaveId/tong-quan`<br>route `/receptionist/dieu-phoi/:leaveId`, `/admin/dieu-phoi/:leaveId` | `pages/receptionist/DieuPhoiLichHen.tsx`, `components/receptionist/DieuPhoiRow.tsx` |
| Duyệt hàng loạt | `POST .../reschedule-approvals/bulk-approve` | `components/receptionist/BulkApproveConfirm.tsx` |

## 3 · Kiểm chứng

**Unit test** — chạy thật `cd backend && npm test` lúc viết tài liệu này (2026-08-23). Output cuối:

```
1..180
# tests 180
# suites 0
# pass 126
# fail 54
# cancelled 0
# skipped 0
# todo 0
# duration_ms 61053.6759
```

Tổng **180 test**, đạt **126**, fail **54**. Toàn bộ 15 test liên quan trực tiếp tới đợt triển khai này
(mục 3 "P0-3/P0-4/P1-6/P1-7" và các test mới của `rescheduleRules.js`, `appointmentReschedule.service.js`,
`walkInWindow.service.js`, index 166–180 trong output) đều `ok`. 54 fail còn lại là các test đã fail từ
trước (pre-existing, không liên quan tới phạm vi đợt này) — con số này khớp với các đợt trước trong cùng
kế hoạch (Task 1–17), không có fail mới phát sinh từ thay đổi của Task 18 (Task 18 không sửa code, chỉ
sửa tài liệu).

**Kiểm thử tay — CHƯA THỰC HIỆN.**

Kế hoạch (Task 17, Step 3) có một bước kiểm thử tay bằng trình duyệt: khởi động dev server, đăng nhập vai
trò lễ tân, thao tác qua kịch bản 8 bước gồm báo nghỉ → modal tóm tắt → trang điều phối → duyệt hàng loạt
→ "Chọn khác…" → khôi phục báo nghỉ giữ nguyên lịch đã dời. Bước này **không được thực hiện** trong quá
trình triển khai tự động ở đợt này — môi trường thực thi (subagent/tự động hoá) không có trình duyệt, không
có dev server đang chạy, và không có tài khoản đăng nhập đã seed sẵn để thao tác qua giao diện thật.

Theo đúng quy ước của dự án (không ghi "đã sửa"/"đạt" cho việc chưa thực sự kiểm chứng), bảng 7 bước kiểm
thử tay **không được điền** ở đây để tránh dữ liệu giả. Đây là việc **còn tồn đọng** — cần một người thật
chạy qua kịch bản này bằng trình duyệt trước khi merge/deploy nhánh `Fix_demo`, bao gồm tối thiểu:

1. Lễ tân/bác sĩ báo nghỉ đột xuất một khung đã có khách đã thanh toán.
2. Modal tóm tắt hiển thị đúng số lịch bị ảnh hưởng và phương án đề xuất.
3. Vào trang điều phối `/receptionist/dieu-phoi/:leaveId`, kiểm tra danh sách lịch + phương án từng dòng.
4. Duyệt hàng loạt (`bulk-approve`) — kiểm tra từng lịch được xử lý là một giao dịch riêng, không rollback
   dây chuyền khi một lịch lỗi.
5. Dùng "Chọn khác…" (`ChonKhacPanel.tsx`) để chọn tay một bác sĩ/slot khác ngoài danh sách đề xuất tự động.
6. Khôi phục báo nghỉ (huỷ đơn nghỉ) — xác nhận các lịch **đã dời xong** giữ nguyên ở chỗ mới, không bị dời
   ngược lại.
7. Xác nhận không có lịch nào bị mất chỗ / bị tính `no_show` / bị mất tiền sai trong toàn bộ luồng trên.

## 4 · Biến môi trường mới
| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DOI_LICH_SO_NGAY_TIM` | 7 | Số ngày tìm phương án dời |
| `DOI_LICH_PHAT_NGAY_PHUT` | 480 | Phạt cộng thêm mỗi ngày phải nhảy sang |

## 5 · Chưa làm
- Bậc ưu tiên `khan_cap` (chưa có cơ chế đánh dấu — không thuộc phạm vi đợt này)
- Trạng thái `cho_dich_vu` (Gap G1–G7 cũ)
- Kiểm thử tay bằng trình duyệt theo kịch bản 8 bước ở Task 17 Step 3 (xem mục 3 ở trên)
