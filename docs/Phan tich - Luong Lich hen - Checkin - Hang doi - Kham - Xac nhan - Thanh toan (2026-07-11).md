# Phân tích luồng nghiệp vụ: Lịch hẹn → Check-in → Hàng đợi → Khám → Y tá nhập hồ sơ → Bác sĩ xác nhận → Thanh toán phát sinh → Hoàn thành

> Chỉ phân tích và lập kế hoạch — **chưa sửa code**. Đọc toàn bộ model liên quan (`LichHen`, `NguoiDung`, `HoaDon`, `ThanhToan`, `KhachVangLai`, `KetQuaKham`, `SinhHieuKham`, `NhatKyThaoTac`), toàn bộ controller/route backend liên quan (`patient/booking`, `admin/appointment`, `admin/payments`, `admin/invoices`, `admin/refunds`, `admin/guest-patients`, `doctor/appointments`, cron), và toàn bộ trang/service frontend liên quan (`client/Booking`, `client/Profile`, `admin/ManageAppointments/*`, `admin/ManagePayments`, `doctor/*`, `routes/AppRoutes`).

---

## 1. Tóm tắt nghiệp vụ đúng nên áp dụng

Đồng ý hoàn toàn với 10 nguyên tắc bắt buộc trong yêu cầu gốc (mục III). Tóm tắt lại làm chuẩn đối chiếu:

- **Appointment ≠ đã đến** — chỉ là lịch dự kiến.
- **Check-in ≠ bắt đầu khám** — chỉ là "đã có mặt, hợp lệ, vào hàng đợi".
- **Hàng đợi thực tế** dựa trên `checkin_time`/`queue_number`/ưu tiên, không dựa cứng vào giờ hẹn.
- **Y tá không chẩn đoán chính** — chỉ tiếp nhận, đo sinh hiệu, nhập hồ sơ theo chỉ định, gửi bác sĩ duyệt.
- **Y tá không tự đặt giá** — giá lấy từ danh mục dịch vụ/thuốc.
- **Bác sĩ không sửa thanh toán** — chỉ xem.
- **Lịch online chưa thanh toán ≠ lịch hợp lệ để khám.**
- **Đặt qua điện thoại không fake PAID.**
- **Walk-in có luồng riêng**, không ép vào luồng online.
- **Hoàn thành khám ≠ hoàn tất thanh toán** — tách 2 khái niệm.

Đây là bộ nguyên tắc đúng. Vấn đề là: **hệ thống hiện tại chưa hiện thực hoá gần như bất kỳ nguyên tắc nào ở trên** (chi tiết mục 9).

---

## 2. Sơ đồ luồng chuẩn (mục tiêu cần đạt tới)

```
[BỆNH NHÂN ONLINE]
  Đặt lịch → status=PENDING_PAYMENT, payment_status=PENDING, hold_expires_at=+15p
    ├─ Thanh toán trong 15p  → status=CONFIRMED, payment_status=PAID
    └─ Quá 15p chưa thanh toán → status=EXPIRED/CANCELLED, slot mở lại

[BỆNH NHÂN PHONE]
  Lễ tân tạo hộ → booking_source=PHONE, payment_method=PAY_AT_CLINIC,
                  payment_status=UNPAID/PENDING, status=CONFIRMED (do NV xác nhận giữ chỗ)

[KHÁCH WALK-IN]
  Đến quầy → Lễ tân tạo lượt khám trong ngày → booking_source=WALK_IN
             → thu phí khám ban đầu (nếu có) → check-in ngay

──────────────────────────────────────────────────────────────
  (mọi nhánh trên hội tụ về đây, chỉ khi status=CONFIRMED)
──────────────────────────────────────────────────────────────

[LỄ TÂN — CHECK-IN]
  Đối chiếu appointment_status=CONFIRMED + payment hợp lệ
  → checkin_time, checked_in_by, queue_number
  → status=CHECKED_IN/WAITING

[HÀNG ĐỢI THỰC TẾ]
  Sắp theo checkin_time/queue_number/ưu tiên — KHÔNG theo appointment_time

[Y TÁ]
  Gọi theo hàng đợi → tiếp nhận, đo sinh hiệu → hỗ trợ bác sĩ

[BÁC SĨ]
  Bấm "Bắt đầu khám" (chỉ khi CHECKED_IN/WAITING) → status=IN_PROGRESS
  Khám, kết luận, chỉ định
  Kết thúc khám → status=WAITING_RECORD

[Y TÁ NHẬP HỒ SƠ]
  Nhập chẩn đoán/thuốc/dịch vụ phát sinh (giá lấy từ danh mục)
  → MedicalRecord.status=WAITING_DOCTOR_CONFIRM

[BÁC SĨ XÁC NHẬN HỒ SƠ]
  Đúng → CONFIRMED         Thiếu/sai → NEED_REVISION (quay lại y tá)
  Nếu CONFIRMED:
    không phí phát sinh chưa trả → status=COMPLETED
    có phí phát sinh chưa trả    → status=WAITING_PAYMENT

[LỄ TÂN/THU NGÂN]
  Xác nhận thanh toán phát sinh → payment_status=PAID → status=COMPLETED
```

---

## 3. Phân biệt 5 khái niệm — hiện trạng model

| Khái niệm | Model hiện tại | Field liên quan | Có tách bảng riêng? |
|---|---|---|---|
| **Appointment** (lịch dự kiến) | `LichHen` | `ngay_kham, gio_kham, status, doctor_id, schedule_id, slot_id` | — |
| **Check-in** (đã đến, hợp lệ) | Gộp chung trong `LichHen` | `trang_thai_den, gio_den_thuc_te, ghi_chu_le_tan, ghi_chu_tiep_nhan` — **chưa có `checkin_time`/`checked_in_by`/`queue_number` thật sự**, các field trên **không được code nào ghi/đọc ngoài seed test** | Không — đang định hình sẵn chỗ trong `LichHen` nhưng bỏ trống |
| **Queue** (hàng đợi thực tế) | **Không tồn tại** | Không có `queue_number`/`queue_order` nào trong schema | Không |
| **MedicalRecord** (hồ sơ khám) | `KetQuaKham` | `status: cho_xac_nhan/da_xac_nhan/yeu_cau_chinh_sua`, `chan_doan`, `dich_vu_phat_sinh` (Mixed, tự do) | Có, tách riêng |
| **Payment/Invoice** | `HoaDon` (hóa đơn) + `ThanhToan` (giao dịch) | `HoaDon.trang_thai_hoa_don`, `ThanhToan.loai_thanh_toan` (phí đặt lịch/đặt cọc/bổ sung) | Có, tách riêng — **nhưng chỉ được tạo khi Admin đặt lịch hộ, KHÔNG được tạo khi bệnh nhân tự đặt online** |

**Kết luận quan trọng nhất:** hệ thống **có sẵn đúng các bảng cần thiết** để làm đúng nghiệp vụ (`HoaDon`, `ThanhToan`, `KhachVangLai`, các field check-in trên `LichHen`) — nhưng chúng là **những hòn đảo rời rạc, chưa được nối dây**. Đây là tin tốt: không cần thiết kế lại DB, chỉ cần nối logic.

---

## 4. Danh sách trạng thái hiện tại trong code

**`LichHen.status`** (`models/LichHen.js:44`): `pending | confirmed | checked_in | in_progress | completed | cancelled | no_show`
- Đang thực sự được set bởi code: `pending`, `confirmed`, `completed`, `cancelled`. 
- **`checked_in`, `in_progress`, `no_show` là dead enum — xác nhận bằng grep toàn backend, không route/service nào set 3 giá trị này** (chỉ script seed test set thẳng để test hiển thị UI).

**`LichHen.payment_status`** (`:47`): `unpaid | partial | paid | refunded`
- `patient/booking.controller.js` set cứng **`payment_status: 'paid'` ngay khi tạo lịch, cho cả clinic lẫn home** — không có bước "chờ thanh toán" nào thực sự chạy qua trạng thái `unpaid`/`pending` trong luồng tự đặt của bệnh nhân.
- Không có giá trị `pending`/`expired` trong enum này — không thể phân biệt "đang chờ thanh toán" với "chưa thanh toán vô thời hạn".

**`HoaDon.trang_thai_hoa_don`**: `chua_thanh_toan | da_dat_coc | da_thanh_toan_du | qua_han` — có logic tính lại tự động (`hoaDon.service.js: tinhTrangThaiHoaDon`), nhưng **chỉ áp dụng cho hóa đơn do Admin tạo** (qua `createAppointment`), không áp dụng cho lịch bệnh nhân tự đặt (không có `HoaDon` nào được tạo).

**`ThanhToan.status`**: `pending | paid | failed | refunded`; `loai_thanh_toan`: `phi_dat_lich | dat_coc | thanh_toan_bo_sung` — đúng ý định "phí ban đầu khác phí phát sinh" nhưng **chưa từng được ghi bởi bất kỳ hành động tự động nào của bệnh nhân**, chỉ ghi thủ công qua `POST /admin/payments`.

**Booking source** (`hinh_thuc_dat_lich`): chỉ có 1 giá trị từng được set là `'admin'` (trong `createAppointment`). Lịch bệnh nhân tự đặt online: field này luôn `null`. Không có giá trị `PHONE`/`WALK_IN` nào từng được ghi.

**`co_the_sua` (khóa 24h) trên `KetQuaKham`/`SinhHieuKham`**: mặc định `true`, không cron nào set `false` — tính năng "khóa sau 24h" chưa hoạt động thật (đã nêu ở audit trước, mục "Phân tích - Chuc nang xac nhan ho so kham").

---

## 5. Trạng thái còn thiếu hoặc đang dùng sai (so với đề xuất mục IV của bạn)

| Đề xuất của bạn | Hiện có? | Ghi chú |
|---|---|---|
| `PENDING_PAYMENT` | ❌ Không có — booking online set thẳng `paid`, không đi qua bước chờ | **Sai nghiêm trọng nhất**: toàn bộ tiền đề "thanh toán trong 15 phút" của bạn **chưa tồn tại trong code**, kể cả field `hold_expires_at`/`payment_deadline` cũng không được set lúc tạo lịch |
| `CONFIRMED` | ✅ Có, nhưng đạt được ngay lập tức (auto), không phải sau khi xác nhận thanh toán thật |
| `CANCELLED` | ✅ Có |
| `EXPIRED` | ❌ Không có giá trị riêng — cron auto-cancel chỉ set thẳng `cancelled`, không phân biệt "hủy do quá hạn" với "hủy do người dùng/bác sĩ" (chỉ khác nhau ở `ly_do_huy` là text tự do) |
| `NO_SHOW` | Có trong enum nhưng **chưa từng được set bởi code nào** — dead |
| `CHECKED_IN` / `WAITING` | Có `checked_in` trong enum LichHen nhưng **dead**, không có `WAITING` riêng, không có `checkin_time`/`checked_in_by`/`queue_number` thật |
| `IN_PROGRESS` | Có trong enum nhưng **dead** |
| `WAITING_RECORD` | ❌ Không có — hiện tại `complete()` nhảy thẳng `status='completed'`, không có bước "chờ y tá nhập hồ sơ" tách biệt |
| `WAITING_DOCTOR_CONFIRM` | Có ở cấp `KetQuaKham.status` (`cho_xac_nhan`) nhưng **không phản chiếu lên `LichHen.status`** — appointment đã `completed` ngay cả khi hồ sơ còn `cho_xac_nhan` |
| `WAITING_PAYMENT` | ❌ Không có — `confirmResult()` luôn set appointment `completed`, không kiểm tra có phí phát sinh chưa thanh toán hay không |
| `PENDING`/payment | Enum `payment_status` thiếu `pending`, `expired` |
| `DEPOSIT_PAID` | Có tương đương ở `HoaDon.trang_thai_hoa_don` (`da_dat_coc`) nhưng không có ở `LichHen.payment_status` |
| `booking_source` đủ 4 giá trị | ❌ Chỉ có `'admin'` vs `null`, không phân biệt `ONLINE`/`PHONE`/`WALK_IN` |
| `payment_method` | ❌ Không tồn tại field này trên `LichHen` — chỉ có `ThanhToan.phuong_thuc` (tiền mặt/chuyển khoản/ví/thẻ), không ánh xạ `PAY_AT_CLINIC` vs `ONLINE_PAYMENT` |

---

## 6. File frontend liên quan (đọc/sửa)

| File | Vai trò hiện tại |
|---|---|
| `pages/client/Booking.tsx` | **100% mock/localStorage** — không gọi API thật, không có bước thanh toán/đếm ngược 15 phút, có bug `user?._id` (đã báo cáo trước) |
| `pages/client/Profile.tsx` | **100% mock/localStorage** — không hiển thị `payment_status` thật, không hiển thị booking_source, so sánh trạng thái `'approved'` sai (đã báo cáo trước) |
| `pages/admin/ManageAppointments/AddAppointment.tsx` | Form "Đặt lịch hộ" — đây thực chất **là** luồng walk-in/phone hiện tại (do Admin làm thay lễ tân), chưa phân biệt PHONE vs WALK_IN |
| `pages/admin/ManageAppointments/AppointmentList.tsx`, `AppointmentDetail.tsx`, `RescheduleAppointment.tsx` | Danh sách/chi tiết/dời lịch — không có nút check-in |
| `pages/admin/ManagePayments.tsx` | Chỉ có 1 hành động "Hoàn tiền" — không có "xác nhận thanh toán"/"tạo giao dịch" |
| `pages/doctor/DoctorAppointments.tsx` | Đã đọc kỹ trước đây — không có nút "Bắt đầu khám" tách biệt với "Hoàn thành" (thực ra đang gộp: nút "Hoàn thành" chính là nút duy nhất, không có trạng thái `IN_PROGRESS` để bấm "bắt đầu") |
| `routes/AppRoutes.tsx`, `routes/ProtectedRoute.tsx` | Chỉ có 2 role được layout riêng: `admin`, `doctor`. `types/index.ts: Role = "user" | "doctor" | "admin"` — **chưa có `nurse`/`receptionist` trong type hệ thống** |
| `pages/auth/Login.tsx` | Có text demo account cho `nurse`/`receptionist` nhưng **không có role/route/auth thật đứng sau** — gây hiểu lầm khi đọc code |
| `services/appointment.service.ts`, `payment.service.ts`, `doctor-appointment.service.ts` | Services thật đã sẵn sàng cho admin/doctor, nhưng **không có service tạo lịch/thanh toán nào được `Booking.tsx` sử dụng** |

## 7. File backend liên quan (đọc/sửa)

| File | Vai trò hiện tại |
|---|---|
| `controllers/patient/booking.controller.js` (hàm `createBooking`) | Set cứng `payment_status:'paid'` bất kể loại khám — nơi cần sửa đầu tiên nếu làm luồng 15 phút thật |
| `services/appointmentAutoCancel.service.js` | Cron 15 phút — hiện chỉ check `payment_deadline` (do bác sĩ set cho home, dead code vì #1), thiếu filter `loai_kham`, **không giải phóng slot khi hết hạn** |
| `cron/index.js` | Đăng ký 2 job — cần thêm hoặc sửa job liên quan |
| `controllers/admin/appointment.controller.js` (`createAppointment`) | Đường walk-in/phone thật duy nhất hiện có — cần bổ sung phân biệt `PHONE` vs `WALK_IN`, và liên kết `khach_vang_lai_id` (hiện chưa từng được set) |
| `controllers/admin/guest-patients.controller.js` | CRUD `KhachVangLai` hoạt động tốt nhưng **chưa nối được vào appointment nào** |
| `controllers/admin/payments.controller.js`, `invoices.controller.js`, `refunds.controller.js` | Ledger thanh toán hoạt động tốt cho luồng Admin, cần mở rộng để tự động sinh khi bệnh nhân tự đặt |
| `controllers/doctor/appointments.controller.js` (`confirm`, `complete`, `confirmResult`) | Đã đọc kỹ — `confirmResult()` luôn set `completed`, không kiểm tra phí phát sinh; **cần sửa để tách `WAITING_PAYMENT`** |
| `models/LichHen.js` | Cần bổ sung field check-in thật (`checkin_time`, `checked_in_by`, `queue_number`) — các field cũ (`trang_thai_den`, `gio_den_thuc_te`...) có thể tái dùng thay vì thêm field mới trùng ý nghĩa |
| `models/NguoiDung.js` | Role enum đã có `receptionist`/`nurse` — chỉ thiếu route/controller, không cần sửa model |
| **Chưa có**: `routes/reception/*`, `routes/nurse/*`, `controllers/reception/*`, `controllers/nurse/*` | Cần tạo mới nếu làm module lễ tân/y tá thật |

## 8. Model/database cần kiểm tra (đã đọc đủ)

`LichHen`, `NguoiDung`, `HoaDon`, `ThanhToan`, `KhachVangLai`, `KetQuaKham`, `SinhHieuKham`, `NhatKyThaoTac`, `LichSuLichHen`, `LichLamViec` — tất cả đã đọc. Không cần thêm bảng mới cho giai đoạn đầu; **ưu tiên nối các bảng đã có** trước khi cân nhắc thêm bảng `Queue` riêng (có thể tính hàng đợi động từ `checkin_time` trên `LichHen`, không nhất thiết cần bảng riêng ở quy mô đồ án).

---

## 9. Đối chiếu 16 lỗi nghiệp vụ nêu trong yêu cầu (mục IX)

| # | Lỗi nghi ngờ | Thực tế trong code |
|---|---|---|
| 1 | Bác sĩ bắt đầu khám khi bệnh nhân chưa check-in | Không áp dụng được vì **chưa có nút "bắt đầu khám" tách biệt** — nhưng vì `checked_in` là dead enum, về lý thuyết nếu thêm nút thì sẽ không có gì chặn cả (chưa có guard) |
| 2 | Bác sĩ sửa được `payment_status` | **Không xảy ra** — trang bác sĩ chỉ đọc, không có nút nào ghi payment_status (đã tự kiểm tra `doctor/*` trước đây) |
| 3 | Bác sĩ check-in bệnh nhân | Không áp dụng — chưa có API check-in nào cả (không phải "bác sĩ chiếm quyền", mà là **chưa ai có quyền này**) |
| 4 | `PENDING_PAYMENT` hiển thị như đã xác nhận | Không hẳn — vì **không có trạng thái `PENDING_PAYMENT` để hiển thị sai**, bản thân bước "chờ thanh toán" không tồn tại (lỗi gốc nặng hơn: bỏ qua bước, không phải hiển thị sai bước) |
| 5 | Lịch quá hạn nhưng slot không mở lại | ✅ **CÓ THẬT** — `appointmentAutoCancel.service.js` không gọi `LichLamViec.findOneAndUpdate` để trả slot về active |
| 6 | Đặt điện thoại fake PAID | Không áp dụng trực tiếp (chưa có luồng phone riêng) nhưng **cùng bản chất lỗi**: `createBooking` fake `paid` cho mọi loại đặt online, không phải riêng phone |
| 7 | Walk-in không có `booking_source` riêng | ✅ **CÓ THẬT** — chỉ có `'admin'` vs `null`, không có `WALK_IN` |
| 8 | Hàng đợi sắp theo `appointment_time` thay vì `checkin_time` | Không áp dụng — **chưa có hàng đợi nào để sắp sai**, đây là tính năng chưa tồn tại chứ không phải tồn tại sai |
| 9 | Y tá được quyền chẩn đoán/sửa giá quá rộng | Không áp dụng — **y tá chưa có bất kỳ quyền/API/UI nào cả** (không phải "quá rộng", mà là "chưa có gì") |
| 10 | Bác sĩ xác nhận hồ sơ xong = COMPLETED dù còn phí phát sinh | ✅ **CÓ THẬT** — `confirmResult()` luôn set `completed`, không kiểm tra `dich_vu_phat_sinh`/hóa đơn |
| 11 | Online đã trả phí ban đầu nhưng không phân biệt phí phát sinh sau khám | ✅ **CÓ THẬT** — `KetQuaKham.dich_vu_phat_sinh` là mảng Mixed tự do, không tự động sinh `ThanhToan`/`HoaDon` tương ứng |
| 12 | Không lưu `checkin_time`/`checked_in_by` | ✅ **CÓ THẬT** — field tồn tại trong schema (`gio_den_thuc_te`...) nhưng không controller nào ghi |
| 13 | Không có `NO_SHOW` | Có trong enum nhưng **dead**, đúng như nghi ngờ |
| 14 | Không giới hạn/cảnh báo bom lịch | Có sẵn cơ chế: `NguoiDung.so_lan_huy_trong_thang`, `bi_han_che_dat_lich`, `han_che_den_ngay` — **model đã có, cần xác minh có controller nào thực sự set các field này khi hủy quá nhiều lần hay không** (chưa kiểm tra sâu, đề xuất kiểm tra thêm nếu ưu tiên) |
| 15 | API tin `doctorId` từ frontend | **Không xảy ra** — đã tự kiểm tra kỹ (`getDocId(req.user.id)` mọi nơi trong `doctor/appointments.controller.js`) |
| 16 | Bác sĩ xem được lịch bác sĩ khác | **Không xảy ra** — đã test bằng `test-doctor-page-api.js` (18/18 pass, có test chéo quyền) |

**Tổng kết mục 9:** lỗi lớn nhất **không phải** "làm sai" các bước 1-3 trong nghiệp vụ liên quan bác sĩ (bác sĩ hiện đang được phân quyền đúng, chặt) — mà là **các bước 4-13 (thanh toán 15 phút, check-in, hàng đợi, y tá, phí phát sinh) hoàn toàn CHƯA TỒN TẠI**, chứ không phải "tồn tại nhưng sai". Đây là tin tốt theo nghĩa: không phải sửa lỗi logic sai, mà là xây phần còn thiếu trên nền model đã có sẵn khá tốt.

---

## 10. Kế hoạch sửa từng bước (đề xuất — CHƯA LÀM, chờ bạn xác nhận phạm vi)

Theo đúng thứ tự ưu tiên bạn đưa ra (mục XII), ánh xạ vào file cụ thể:

**Bước 1 — Chuẩn hoá trạng thái** (rủi ro thấp, nền tảng cho mọi bước sau)
- Thêm `pending`, `expired` vào `LichHen.payment_status` enum.
- Thêm field `checkin_time`, `checked_in_by`, `queue_number`, `booking_source` (enum `online|phone|walk_in|admin`), `payment_method` vào `LichHen` — tái dùng chỗ trống của `trang_thai_den`/`gio_den_thuc_te` thay vì tạo field trùng lặp (cần bạn quyết định: đổi tên field cũ hay thêm field mới).
- File: `models/LichHen.js`.

**Bước 2 — Luồng thanh toán online 15 phút**
- Sửa `createBooking`: set `status='pending'`, `payment_status='pending'`, `payment_deadline=+15p` thay vì fake `paid` ngay.
- Cần thêm 1 bước "xác nhận thanh toán" thật (endpoint mới hoặc giả lập webhook cho đồ án) để chuyển `confirmed`+`paid`.
- File: `controllers/patient/booking.controller.js` + route mới `patient/payment.routes.js` (chưa tồn tại).
- **Rủi ro:** đây là thay đổi lớn nhất, ảnh hưởng trực tiếp trải nghiệm đặt lịch hiện tại — cần xác nhận kỹ trước khi đụng.

**Bước 3 — Check-in**
- Tạo API mới `PATCH /reception/appointments/:id/check-in` (cần quyết định: gắn vào `admin` routes tạm thời, hay tạo `routes/reception/*` mới cho role `receptionist` đã có sẵn trong enum).
- Set `checkin_time`, `checked_in_by`, `status/visit_status` sang trạng thái đã check-in — dùng lại `checked_in` (đang dead) thay vì thêm giá trị mới.

**Bước 4 — Hàng đợi thực tế**
- Không cần bảng riêng: thêm 1 API `GET .../queue?date=` sắp theo `checkin_time` cho các appointment `status='checked_in'` cùng ngày.

**Bước 5 — Quyền bác sĩ với lịch hẹn**
- Đã đúng phần lớn — chỉ cần thêm guard: nút "Bắt đầu khám" chỉ hiện khi `status==='checked_in'`, set `in_progress` khi bấm.

**Bước 6 — Luồng y tá nhập hồ sơ**
- Cần tạo role/route/controller mới cho `nurse` (hiện chưa có gì) — đây là việc lớn nhất còn lại, tương đương xây 1 module mới từ đầu (đã phân tích sẵn ở `docs/NURSE_DOCTOR_WORKFLOW.md` từ trước).

**Bước 7 — Bác sĩ xác nhận hồ sơ có tính phí phát sinh**
- Sửa `confirmResult()`: kiểm tra `KetQuaKham.dich_vu_phat_sinh`/hóa đơn liên quan trước khi set `completed`; nếu có phí chưa trả → `WAITING_PAYMENT` thay vì `completed` thẳng.
- File: `controllers/doctor/appointments.controller.js`.

**Bước 8 — Thanh toán phát sinh**
- Tự động tạo `ThanhToan` (`loai_thanh_toan:'thanh_toan_bo_sung'`) khi hồ sơ có `dich_vu_phat_sinh`; lễ tân xác nhận qua `POST /admin/payments` đã có sẵn (chỉ cần nối, không cần API mới).

**Bước 9 — Test case** (xem mục 11 dưới).

**Bước 10 — Rà lại toàn bộ.**

**Khuyến nghị:** Bước 2 và Bước 6 là 2 việc lớn nhất (thay đổi luồng thanh toán cốt lõi, và dựng cả 1 module y tá từ số 0) — nên làm riêng, xác nhận từng bước, không gộp chung 1 lần sửa.

---

## 11. Test case đề xuất (mục XI) — đối chiếu trạng thái PASS/FAIL nếu chạy ngay bây giờ

| # | Test case | Kết quả nếu chạy ngay hôm nay |
|---|---|---|
| 1 | Online thanh toán trong 15p → CONFIRMED+PAID | ❌ N/A — không có bước chờ thanh toán, mọi lịch online đã `paid` ngay lập tức |
| 2 | Online không thanh toán sau 15p → CANCELLED/EXPIRED + mở slot | ❌ N/A tương tự, và nếu giả lập được trạng thái này thì slot cũng **không được mở lại** (lỗi #5 mục 9) |
| 3 | Online đã thanh toán đến check-in → CHECKED_IN + có `checkin_time` | ❌ Chưa có API check-in nào |
| 4 | Bác sĩ cố bắt đầu khám khi chưa check-in → bị từ chối | ❌ Chưa có nút/API "bắt đầu khám" để test |
| 5 | Bác sĩ bắt đầu khám khi đã check-in → IN_PROGRESS | ❌ Tương tự |
| 6 | Phone booking chưa thanh toán → đúng field, không PAID | ❌ Chưa có luồng phone riêng |
| 7 | Walk-in tại quầy → đúng `booking_source`, có check-in, vào hàng đợi | ⚠️ Có thể tạo qua `AddAppointment` (Admin) nhưng không set `booking_source=WALK_IN` đúng, không check-in được |
| 8 | Y tá nhập hồ sơ sau khám → `WAITING_DOCTOR_CONFIRM` | ⚠️ Có tương đương ở cấp bác sĩ tự nhập (`cho_xac_nhan`), nhưng không phải y tá vì y tá chưa có quyền |
| 9 | Bác sĩ xác nhận hồ sơ không phí phát sinh → COMPLETED | ✅ **PASS** — đã test qua `test-doctor-page-api.js` |
| 10 | Bác sĩ xác nhận hồ sơ có phí phát sinh chưa trả → WAITING_PAYMENT, chưa COMPLETED | ❌ **FAIL** — hiện luôn set `completed` bất kể phí phát sinh (lỗi #10 mục 9) |
| 11 | Lễ tân xác nhận thanh toán phát sinh → COMPLETED | ❌ Không có liên kết giữa việc xác nhận thanh toán và cập nhật appointment status |
| 12 | Bệnh nhân không đến → NO_SHOW/CANCELLED | ❌ `no_show` là dead enum |

**Kết luận mục 11:** chỉ 1/12 test case pass được với hệ thống hiện tại (case 9, vì nó không phụ thuộc các phần còn thiếu). Đây là con số định lượng cho thấy khoảng cách giữa nghiệp vụ mong muốn và code thực tế.

---

## 13. Kết quả thực thi (2026-07-11) — 2 quick-win đã chọn

Bạn chọn làm ngay 2 việc rủi ro thấp, độc lập với luồng đặt lịch/thanh toán chính (chưa đụng Bước 1-2 và các bước còn lại).

### 13.1. Cron auto-cancel không mở lại slot (lỗi #5 mục 9)

- **File sửa:** `backend/src/services/appointmentAutoCancel.service.js`.
- **Trước đó sai gì:** khi lịch quá hạn thanh toán bị tự động hủy (`status='cancelled'`), code chỉ lưu lại `LichHen`, **không hề đụng vào `LichLamViec`** — slot đã giữ chỗ (`slots.$.status`) vẫn kẹt ở `booked` mãi mãi, không ai đặt lại được khung giờ đó dù lịch đã hủy.
- **Đã sửa:** thêm đúng 1 khối `LichLamViec.findOneAndUpdate(...)` set `slots.$.status='active'`, `slots.$.benh_nhan_id=null` — **copy y hệt pattern đã có sẵn và đã chạy đúng** ở nhánh "hủy thường" trong `doctor/appointments.controller.js:cancel()` và `admin/appointment.controller.js:cancelAppointment()`, không phát minh cách làm mới.
- **Sau khi sửa:** lịch hủy tự động do quá hạn thanh toán → slot quay lại `active`, bệnh nhân khác đặt được ngay khung giờ đó.
- **Đã kiểm tra thêm (trước khi kết luận có lỗi):** ban đầu nghi ngờ thêm 1 lỗi nặng hơn — liệu `payment_deadline: null` (mặc định của các lịch `admin` tạo hộ, không set deadline) có vô tình bị match bởi `{$lt: new Date()}` theo thứ tự so sánh kiểu BSON của Mongo hay không (nếu đúng thì các lịch walk-in/phone chưa thanh toán sẽ bị tự hủy oan). Đã viết script kiểm chứng thực tế trên chính MongoDB của dự án (tạo 1 bản ghi tạm với `payment_deadline: null`, chạy đúng câu query, xóa ngay sau khi có kết quả) — **kết quả: `null` KHÔNG bị match**, nên đây không phải là lỗi. Không có lịch nào bị ảnh hưởng oan.
- **Rủi ro còn lại:** không có — thay đổi tối thiểu, tái dùng pattern đã kiểm chứng, `npm test` vẫn 8/11 pass (3 fail còn lại là lỗi cũ đã báo cáo, không liên quan).

### 13.2. Bác sĩ xác nhận hồ sơ luôn COMPLETED dù còn phí phát sinh (lỗi #10 mục 9)

- **File sửa:** `backend/src/controllers/doctor/appointments.controller.js` (`createResult` và `confirmResult`).
- **Trước đó sai gì:** cả 2 hàm đều set thẳng `a.status = 'completed'` mà không kiểm tra `KetQuaKham.dich_vu_phat_sinh` (mảng dịch vụ phát sinh) có rỗng hay không.
- **Đã sửa:** thêm điều kiện `result.dich_vu_phat_sinh.length === 0` vào cả 2 nơi — chỉ tự động hoàn thành lịch hẹn khi hồ sơ không có dịch vụ phát sinh.
- **⚠️ Lưu ý quan trọng — đây là fix phòng vệ, CHƯA có tác dụng quan sát được ngay hôm nay:** đã grep toàn bộ backend + frontend và xác nhận **`dich_vu_phat_sinh` hiện không được bất kỳ API/UI nào ghi dữ liệu vào** (`createResult`/`updateResult` không nhận field này từ `req.body`, không có UI nào cho bác sĩ/y tá thêm dịch vụ phát sinh). Nghĩa là hôm nay, trường này luôn là mảng rỗng `[]` theo mặc định của schema → điều kiện mới thêm **luôn đúng (rỗng), hành vi không đổi so với trước**. Đây KHÔNG phải là dữ liệu giả — code đã đúng theo nghiệp vụ và sẽ tự động phát huy tác dụng ngay khi Bước 6-8 (y tá nhập dịch vụ phát sinh + màn xác nhận thanh toán) được làm — nhưng tôi cần nói rõ để bạn không hiểu nhầm là bug đã "hết" có thể test được ngay bây giờ; thực ra chưa có cách nào tạo dữ liệu để kích hoạt nhánh này trong hệ thống hiện tại.
- **Rủi ro còn lại:** không có rủi ro tiêu cực (thay đổi an toàn), nhưng **giá trị thực tế = 0 cho tới khi Bước 6-8 được triển khai** — nên xem đây là "đặt nền trước", không phải "đã xong tính năng".

## 14. Rủi ro nếu triển khai vội

- Sửa `createBooking` (bước 2) mà không kiểm tra kỹ **sẽ phá luồng đặt lịch đang chạy demo được** (dù demo 2026-07-04 đã qua, nhưng đây vẫn là tính năng core, cần test kỹ trước khi đổi).
- Dựng module y tá (bước 6) là khối lượng công việc lớn nhất — không nên làm chung với các bước khác trong 1 lần.
- Cron auto-cancel (`appointmentAutoCancel.service.js`) đang thiếu giải phóng slot — đây là **bug độc lập, an toàn để sửa ngay, không phụ thuộc các bước khác** — có thể ưu tiên sửa sớm nếu bạn muốn 1 quick-win rủi ro thấp trước khi làm các việc lớn.
