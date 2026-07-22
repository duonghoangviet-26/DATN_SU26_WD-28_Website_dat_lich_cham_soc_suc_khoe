# PROMPT 23 — Báo cáo sửa Danh sách hồ sơ cần nhập (Y tá)

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Trang mới "Hồ sơ cần nhập". Không sửa form hồ sơ.

## Thay đổi

**Backend:**
| File | Thay đổi |
|---|---|
| `controllers/nurse/appointments.controller.js` | thêm `pendingRecords` (`GET /nurse/appointments/pending-records?date=`): lịch trong ca ở status `waiting_record`/`waiting_doctor_confirm`, gắn `giai_doan` (`chua_tao`/`ban_nhap`/`cho_xac_nhan`/`yeu_cau_chinh_sua`), loại `da_xac_nhan`, sort ưu tiên; **CHỈ ĐỌC** |
| `routes/nurse/appointments.routes.js` | thêm route `GET /pending-records` (đặt **trước** `/:id`) |

**Frontend:**
| File | Thay đổi |
|---|---|
| `types/index.ts` | thêm `NursePendingStage`, `NursePendingRecord` |
| `services/nurse.service.ts` | thêm `getPendingRecords({date})` |
| `pages/nurse/NursePendingRecords.tsx` | trang mới: lọc ngày + giai đoạn, badge giai đoạn, nút hành động theo giai đoạn (Nhập/Tiếp tục/Xem/Sửa) → điều hướng chi tiết; loading/error/empty |
| `routes/nurseMenu.ts` | thêm mục "Hồ sơ cần nhập" |
| `routes/AppRoutes.tsx` | thêm route `pending-records` |
| `pages/nurse/NurseDashboard.tsx` | thẻ "Chờ nhập hồ sơ" → `/nurse/pending-records` |

## Đáp ứng yêu cầu
- **Chỉ lấy lịch đúng bước cho phép nhập** ✅ (`status ∈ {waiting_record, waiting_doctor_confirm}`).
- **Chỉ lịch thuộc ca** ✅ (`getMyDoctorIdsOnDate`).
- **Không hiển thị lịch hủy** ✅ (`cancelled`/`no_show` không nằm trong 2 status).
- **Không hiển thị hồ sơ đã xác nhận** ✅ (loại `da_xac_nhan`; lịch confirmed đã sang `completed` nên không lọt vào waiting_*).
- **Phân biệt 4 giai đoạn** ✅: `chua_tao` (Chưa tạo hồ sơ), `ban_nhap` (Đang nháp), `cho_xac_nhan` (Đã gửi bác sĩ), `yeu_cau_chinh_sua` (Bác sĩ yêu cầu sửa).
- **Filter** ✅ (ngày [backend] + giai đoạn [client]).
- **Sort ưu tiên + thời gian** ✅ (`chua_tao`/`yeu_cau_chinh_sua`=0 → `ban_nhap`=1 → `cho_xac_nhan`=2, rồi `gio_kham`).
- **loading/error/empty** ✅.
- **Không tạo hồ sơ tự động khi mở danh sách** ✅ (endpoint chỉ `find`/`findOne`, không `create`).
- **Không mock** ✅ · **Không sửa form hồ sơ** ✅.

## Kiểm thử
- **Backend syntax** `node --check` 2 file → OK.
- **Frontend type-check** → **110 lỗi/3 file = baseline**, 0 lỗi mới.
- **Build** `vite build` → ✅ (8.05s).
- **Probe READ-ONLY (dữ liệu thật):**

| Kịch bản | Kết quả |
|---|---|
| Có lịch cần nhập | 07-14 & 07-15: mỗi ngày 1 lịch `waiting_doctor_confirm`, `giai_doan=chua_tao` (chưa có hồ sơ) ✅ |
| Sort ưu tiên | `chua_tao`/`yeu_cau_chinh_sua` lên trước ✅ (verified) |
| Loại hủy/đã xác nhận | status gate + filter `da_xac_nhan` ✅ |
| Empty | hôm nay 0 ca → `[]` ✅ |
| Không tạo tự động | endpoint không có `create` ✅ |

- **Chưa chạy live** — cần server + seed hôm nay (Bước 17).

## Rủi ro & ghi nhận
- **Rủi ro thấp.** Endpoint mới chỉ đọc, có guard + scope theo ca; trang mới độc lập.
- **Anomaly dữ liệu thật (không sửa):** vài lịch ở `waiting_doctor_confirm` nhưng **không có `KetQuaKham`** (giai đoạn tính là `chua_tao`) — trạng thái lịch/hồ sơ lệch (data test cũ). Endpoint xử lý an toàn (coi như cần nhập). Ghi nhận.
- **Trùng ngày ca** (07-14/07-15) khiến 1 lịch xuất hiện ở cả 2 ngày — do dữ liệu `LichLamViec`/`ngay_kham` lệch giờ (đã ghi nhận PROMPT 20, kế hoạch DB riêng).

## Vấn đề còn tồn
- Chuẩn hóa dữ liệu lệch trạng thái (`waiting_doctor_confirm` mà thiếu hồ sơ) → kế hoạch DB riêng.
- Full UI test chờ seed hôm nay (Bước 17).
