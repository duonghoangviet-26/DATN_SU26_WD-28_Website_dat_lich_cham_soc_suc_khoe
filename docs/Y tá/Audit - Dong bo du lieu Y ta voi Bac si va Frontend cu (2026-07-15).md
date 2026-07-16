# Audit — Đồng bộ dữ liệu Y tá ↔ Bác sĩ & khoảng trống Frontend cũ

> Mục đích: sau khi Kế hoạch 1 (DB) + Kế hoạch 2 (Backend Trạng thái phòng/Hàng đợi/Gọi bệnh nhân)
> hoàn tất, kiểm tra lại toàn bộ trang Y tá cũ (frontend) + các điểm giao dữ liệu với trang Bác sĩ,
> Admin, Khách hàng để tìm chỗ **chưa đồng nhất** trước khi sửa hàng loạt.
> Phạm vi: đọc — không sửa code trong audit này.

---

## A. Backend — lỗ hổng đồng bộ (3 điểm)

Nguồn gốc chung: `LichHen.status` enum vừa được mở rộng ở Kế hoạch 1
(`waiting_record`, `skipped` mới), và Kế hoạch 2 làm luồng hàng đợi động
(`HangDoi`) đưa lịch hẹn qua `in_progress → waiting_record` **không thông
qua** các hàm cũ vốn chỉ biết `confirmed/completed`.

1. **`backend/src/controllers/nurse/dashboard.controller.js`**
   - `cho_nhap_ho_so` (dòng 47-49) chỉ tính `['confirmed', 'completed']`.
   - `hang_doi_gan_nhat` (dòng 60) filter `['confirmed', 'checked_in', 'in_progress', 'waiting_doctor_confirm']`.
   - Cả 2 đều thiếu `waiting_record`/`skipped` → lịch hẹn "biến mất" khỏi dashboard y tá
     ngay khi y tá kết thúc khám qua hàng đợi mới (cùng lớp bug đã sửa ở
     `nurse/appointments.controller.js` trong Kế hoạch 2, nhưng dashboard chưa được vá).

2. **`backend/src/controllers/doctor/appointments.controller.js`**
   - `complete()` (dòng 178) chỉ chấp nhận `status === 'confirmed'`.
   - `createResult()` (dòng 223) chỉ chấp nhận `['confirmed', 'completed']`.
   - Khi bệnh nhân đã qua hàng đợi y tá (`intoRoom` → `in_progress`, `finish` → `waiting_record`),
     bác sĩ tự thao tác trực tiếp (không qua y tá nhập nháp) sẽ bị 409 vì status không còn
     `confirmed`. Đây là điểm **thực sự chặn luồng** nếu bác sĩ muốn tự nhập kết quả sau khi
     y tá đã gọi bệnh nhân qua hàng đợi mới mà chưa kịp nhập hồ sơ.

3. **`backend/src/controllers/doctor/stats.controller.js: getTodayOverview()`**
   - Dòng 112: `y_ta_ho_tro: null` — comment cũ "hệ thống chưa có module gán y tá cho ca làm việc"
     nhưng module đó (`LichLamViec.nurse_id`) đã có từ Kế hoạch 1. Dashboard bác sĩ đang hiển thị
     sai dữ liệu (luôn trống) dù dữ liệu thật đã tồn tại.
   - Phụ: `cho_kham` (dòng 114) chỉ đếm `status==='confirmed'`, không tính `checked_in` — khác
     cách đếm bên y tá (`dang_cho_kham` tính cả `confirmed`+`checked_in`).

---

## B. Frontend — khoảng trống & trùng lặp

### B1. Nguồn dữ liệu gốc đã lệch với backend

- **`frontend/src/types/index.ts:7-14`** — `AppointmentStatus` union **thiếu cả 3**:
  `waiting_doctor_confirm` (thiếu từ trước, chưa từng đúng), `waiting_record`, `skipped` (mới).
  Nhiều `Record<AppointmentStatus, ...>` (vd `DoctorDashboard.tsx:14`) type theo union này nên
  TypeScript hiện KHÔNG báo lỗi thiếu key — chỉ báo khi union được nới đúng.
- **`frontend/src/utils/constants.ts`** — `APPOINTMENT_STATUS_LABEL` (dòng 47-56) và
  `APPOINTMENT_STATUS_COLOR` (dòng 62-71): cùng thiếu `waiting_record`, `skipped`.

### B2. Bản đồ trạng thái cục bộ trùng lặp, không đồng nhất (do KHÔNG dùng constants.ts)

Tất cả các file dưới đây tự định nghĩa map riêng, không cái nào có `waiting_record`/`skipped`,
và phạm vi key khác nhau giữa các trang:

| File | Loại map | Thiếu |
|---|---|---|
| `pages/nurse/NurseQueue.tsx:11-14` | `STATUS_COLOR` (5 key) | hẹp nhất, thiếu nhiều nhất |
| `pages/doctor/DoctorDashboard.tsx:14-17` | `STATUS_COLOR` (7 key) | `waiting_doctor_confirm/waiting_record/skipped` |
| `pages/admin/ManageAppointments/AppointmentList.tsx:9-17` | `STATUS_COLOR` (7 key) | thiếu `waiting_doctor_confirm` trở lên |
| `pages/admin/ManageAppointments/DoctorAppointmentGroupList.tsx:9-17` | `STATUS_COLOR` (giống hệt trên) | như trên |
| `pages/admin/ManageAppointments/AppointmentHistoryModal.tsx:28-36+` | gộp status+payment | như trên |
| `pages/admin/ManageDoctor/DoctorDetailDrawer.tsx:9-11` | `STATUS_COLOR` (4 key) | rất hẹp |
| `pages/client/Profile.tsx:130-148` | `getStatusBadge/getStatusLabel` viết tay, **không dùng constants.ts** | mọi status ngoài `completed/confirmed/cancelled` rơi vào nhãn mặc định gây hiểu lầm ("Chờ xác nhận" cho cả `in_progress`, `no_show`...) |

`KetQuaKhamStatus` label (`KET_QUA_STATUS_LABEL`) bị lặp lại y hệt ở **3 nơi** riêng biệt:
`NurseAppointmentDetail.tsx:11-16`, `DoctorAppointments.tsx:25-30`, `DoctorPendingRecords.tsx:12-17`
— chưa từng được đưa vào `constants.ts` (chỉ có màu `KET_QUA_KHAM_STATUS_COLOR`, thiếu nhãn).

### B3. Trang Y tá — chưa dùng bất kỳ endpoint nào của Kế hoạch 2

- **`nurse.service.ts`** (56 dòng): 8 hàm, toàn bộ nhắm vào `/nurse/dashboard`, `/nurse/appointments`,
  `/nurse/medical-records*`. **Không có** wrapper cho 7 endpoint mới (`/nurse/room-status` GET/PATCH,
  `/nurse/queue` GET/POST checkin/PATCH call/into-room/finish/skip/cancel).
- **`NurseQueue.tsx`** gọi `GET /nurse/appointments` (endpoint cũ) chứ không phải `GET /nurse/queue`
  (hàng đợi động mới) — dropdown lọc trạng thái hardcode 5 giá trị, thiếu `pending/waiting_record/skipped/cancelled/no_show`.
- **Không trang nào** có: nút check-in, gọi bệnh nhân, vào phòng, kết thúc khám, bỏ lượt, hủy lượt,
  hay bảng trạng thái phòng (room-status board). Toàn bộ 7 hành động nghiệp vụ cốt lõi của Kế hoạch 2
  chưa có giao diện.
- **`NurseAppointmentDetail.tsx`**: `canFillForm` (dòng 98) chặn `cancelled/no_show` nhưng **không
  chặn `skipped`** — hồ sơ khám vẫn hiện form nhập cho ca đã bỏ lượt. Không có UI kê đơn thuốc/dịch vụ
  phát sinh (khác trang bác sĩ đã có `PrescriptionDrug[]` đầy đủ).
- **`types/index.ts`**: chưa có type cho response `/nurse/room-status`, `/nurse/queue`, hay payload
  checkin. `NurseMedicalRecord` (dòng 1105-1118) không có field `thuoc`/dịch vụ phát sinh — không đối
  xứng với `ExaminationResult.thuoc` bên bác sĩ (dòng 846).
- **`nurseMenu.ts`**: chỉ có "Tổng quan" + "Hàng đợi bệnh nhân" + "Hồ sơ cần chỉnh sửa" — không có
  mục menu cho trạng thái phòng/hàng đợi động mới.

---

## C. Kết luận phạm vi

Việc "chỉnh sửa hàng loạt trang Y tá" không thể tách rời khỏi:
1. Vá 3 lỗ hổng backend (A) — nếu không, UI mới build trên dữ liệu sai/thiếu ngay từ đầu.
2. Đưa `AppointmentStatus`, `APPOINTMENT_STATUS_LABEL/COLOR`, `KET_QUA_STATUS_LABEL` về **một nguồn
   duy nhất** (`constants.ts` + `types/index.ts`) — nếu không, sửa xong trang y tá mà không đụng các
   bản đồ trùng lặp ở bác sĩ/admin/khách hàng thì lại tạo thêm một điểm lệch dữ liệu mới.
3. Thêm service layer + types cho 7 endpoint Kế hoạch 2 (chưa có gì).
4. Xây UI hàng đợi động + bảng trạng thái phòng — phần việc chính, hiện là khoảng trống 100%.
5. Lan tỏa nhãn trạng thái đã đồng bộ ra các trang bác sĩ/admin/khách hàng đang tự định nghĩa map
   riêng (7 file ở B2).

→ Đề xuất triển khai theo **3 kế hoạch kế tiếp** (đúng quy ước "1 phần = 1 thiết kế + kế hoạch riêng,
xong mới sang phần sau" đã dùng cho Kế hoạch 1–2):

- **Kế hoạch 3 — Nền tảng đồng bộ dữ liệu**: vá 3 bug backend (A) + gộp `AppointmentStatus`/label/color
  về 1 nguồn + thêm type + service layer cho 7 endpoint mới. Không đụng UI.
- **Kế hoạch 4 — Giao diện Hàng đợi & Trạng thái phòng (Y tá)**: trang/khu vực mới cho check-in, gọi
  bệnh nhân, vào phòng, kết thúc, bỏ lượt, hủy lượt, bảng trạng thái phòng; cập nhật `NurseQueue.tsx`
  dùng endpoint mới; sửa `canFillForm` bỏ sót `skipped`; cập nhật `nurseMenu.ts`.
- **Kế hoạch 5 — Lan tỏa nhãn trạng thái**: thay 7 file map cục bộ (B2) bằng nguồn chung, ưu tiên
  `client/Profile.tsx` (đang gây hiểu lầm nhãn trạng thái cho bệnh nhân) và `DoctorDashboard.tsx`.
