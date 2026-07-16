# Thiết kế & Đối chiếu — Trang Y tá (đối chiếu đặc tả đầy đủ mục I–XXI với code hiện tại)

> **Chưa sửa code** — đúng yêu cầu mục XXI ("trước khi sửa code, phải báo cáo"). Đây là báo cáo kiểm tra + thiết kế, chờ xác nhận trước khi làm.
> Đã đọc trực tiếp model liên quan (`NguoiDung`, `LichHen`, `LichLamViec`, `KetQuaKham`, `SinhHieuKham`, `PhongKham`, `DonThuoc`) và grep toàn bộ `frontend/src`, `backend/src` cho từ khóa `nurse` trước khi viết — **xác nhận lại: chưa có bất kỳ file nào** (route/controller/model/page) cho y tá, y hệt kết luận trong tài liệu thiết kế trước đó.
> Đọc kèm: [[NURSE_DOCTOR_WORKFLOW]] (thiết kế gốc, 2026-07-10 — tài liệu này **cập nhật + cụ thể hóa thành báo cáo theo đúng cấu trúc XIX** bạn yêu cầu, không mâu thuẫn, chỉ bổ sung chi tiết field-level còn thiếu ở bản trước).

---

## 1. Tổng quan trang y tá hiện tại

**Không tồn tại.** `NguoiDung.role` đã có `'nurse'` trong enum (`NguoiDung.js:29`) nhưng không có route, controller, model, hay trang frontend nào đọc/ghi theo vai trò này. Y tá hiện tại **không đăng nhập được vào chức năng gì** — nếu tạo tài khoản role=`nurse`, tài khoản đó sẽ không match `requireRole()` của bất kỳ route nào (`doctor`, `admin`), tức bị khóa hoàn toàn ngoài các route chung (nếu có).

## 2. Các chức năng đã có

Không có chức năng nào **dành riêng cho** y tá. Tuy nhiên có 4 model nền tảng **đã tồn tại sẵn và khớp gần đúng** với nhu cầu của trang y tá, dùng được ngay khi xây route/controller mới (không cần đổi cấu trúc, chỉ cần bổ sung field):

| Model có sẵn | Khớp với nhu cầu y tá ở đâu |
|---|---|
| `SinhHieuKham` | Chính là "vital signs" mục VII.B — đã có `can_nang`, `chieu_cao`, `huyet_ap`, `nhiet_do`, `nhip_tim`, `nguoi_do_id`, `thoi_diem_do`, `co_the_sua`, `lich_su_cap_nhat` |
| `KetQuaKham` | Chính là "MedicalRecord" — đã có `status` (3/4 giá trị cần), `lich_su_sua[]`, `co_the_sua`, `nguoi_nhap_id`, `dich_vu_phat_sinh[]` |
| `DonThuoc` | Đơn thuốc gắn theo `ket_qua_kham_id` — đã dùng được ngay cho mục IX |
| `PhongKham` | Danh mục phòng thật (`ten`, `tang`, `toa`, `loai`) — **đã tồn tại**, chỉ là `LichHen.phong_kham`/`LichLamViec.slots[].phong_kham` lưu String snapshot thay vì ref ObjectId (quyết định thiết kế có chủ đích — xem comment `PhongKham.js:11-13`, để lịch cũ không bị ảnh hưởng khi phòng đổi tên) |

**Không có gì hoạt động được từ góc nhìn y tá** — các model trên hiện chỉ được bác sĩ ghi trực tiếp (`doctor/appointments.controller.js`), không có actor "y tá" tách biệt.

## 3. Các chức năng còn thiếu

Toàn bộ 9 route ở mục III, toàn bộ dashboard mục IV, toàn bộ hàng đợi mục V, toàn bộ luồng tiếp nhận mục VI, model `YTa`, field `nurse_id`/`checkin_time`/`checked_in_by`/`queue_number` trên `LichHen`, state `WAITING_RECORD`/`WAITING_DOCTOR_CONFIRM` trên `LichHen.status`, state `DRAFT` trên `KetQuaKham.status`. Chi tiết field-by-field ở mục 6/14.

## 4. Các file frontend liên quan

**Không có file nào** (`Glob frontend/src/**/nurse*` → 0 kết quả). File gần nhất có thể tham khảo làm mẫu khi xây mới: `frontend/src/pages/doctor/DoctorAppointments.tsx` (pattern expand-row + modal), `frontend/src/layouts/*Layout.jsx` (làm mẫu cho `NurseLayout` mới), `frontend/src/routes/AppRoutes.tsx` + `ProtectedRoute.tsx` (nơi cần thêm route/role mới).

## 5. Các file backend liên quan

**Không có file nào** (`Glob backend/src/**/nurse*` → 0 kết quả). File mẫu để copy pattern: `backend/src/routes/doctor/index.js` (mẫu mount `verifyToken + requireRole`), `backend/src/controllers/doctor/appointments.controller.js` (mẫu lấy id từ token, không tin FE — hàm `getDocId()`).

## 6. Các model/database liên quan — đối chiếu field-by-field (mục XIII)

### 6.1 `LichHen` (Appointment) — hiện có vs. spec yêu cầu

| Field spec yêu cầu | Có trong `LichHen` hiện tại? | Ghi chú |
|---|---|---|
| `patient_id` | ✅ (`user_id`, `member_id`, hoặc `ten_khach` cho khách vãng lai) | Đã đủ, tên khác |
| `doctor_id` | ✅ | |
| `nurse_id` | ❌ **chưa có** | Cần thêm — xem [[NURSE_DOCTOR_WORKFLOW]] mục 10.3 (đã thiết kế sẵn) |
| `service_id`, `schedule_id` | ✅ | |
| `room_id` | ⚠️ Có `phong_kham` (String snapshot), không có `room_id` ObjectId | Chủ đích thiết kế (mục 2) — không cần đổi nếu không có yêu cầu ràng buộc trùng phòng thời gian thực |
| `appointment_date`/`appointment_time` | ✅ (`ngay_kham`, `gio_kham`) | |
| `appointment_status` | ✅ (`status`, enum 7 giá trị) | 3/7 giá trị chết (`checked_in`, `in_progress`, `no_show` — chưa ai set) |
| `visit_status`/`queue_status` | ❌ **chưa có field riêng** | Hiện dùng chung `status` — cần tách hoặc bổ sung enum |
| `payment_status` | ✅ (4 giá trị: `unpaid/partial/paid/refunded`) | Chưa có `PENDING`/`DEPOSIT_PAID`/`EXPIRED` riêng |
| `booking_source` | ❌ **chưa có** | Chỉ có `loai_kham` (`clinic`/`home` — khác chiều với ONLINE/PHONE/WALK_IN) |
| `payment_method` | ⚠️ Chưa thấy field này trên `LichHen` (chưa verify sâu — nằm ngoài phạm vi đã đọc) | Cần verify thêm nếu làm |
| `reason` | ✅ (`ly_do_kham`) | |
| `checkin_time` | ❌ **chưa có** | Có field gần giống nhưng chết: `gio_den_thuc_te` (Date, không ai set) |
| `checked_in_by` | ❌ **chưa có** | |
| `queue_number` | ❌ **chưa có** | |

### 6.2 `KetQuaKham` (MedicalRecord)

| Field spec yêu cầu | Có hiện tại? |
|---|---|
| `appointment_id`, `doctor_id` (`bac_si_phu_trach_id`), `nurse_id` (`nguoi_nhap_id` — generic `NguoiDung`, không ép kiểu y tá) | ✅ có tương đương |
| `vital_signs` | ⚠️ Tách model riêng `SinhHieuKham` (hợp lý hơn nhúng — không cần gộp vào `KetQuaKham`) |
| `initial_symptoms`, `nurse_note` | ❌ chưa có field riêng — hiện chỉ có `ghi_chu` dùng chung, không phân biệt "ghi chú điều dưỡng" vs "ghi chú chuyên môn bác sĩ" |
| `symptoms`, `diagnosis` (`chan_doan`), `conclusion`, `treatment_plan` (`huong_dan_dieu_tri`) | ⚠️ Có tương đương nhưng gộp chung ít field hơn spec (không tách `symptoms` riêng `diagnosis`) |
| `prescription_note`, `medicines` | ✅ qua `DonThuoc` (model riêng, đã liên kết `ket_qua_kham_id`) |
| `services_used` | ⚠️ Có `dich_vu_phat_sinh[]` nhưng kiểu `Mixed`, **chưa ai ghi** (đã xác nhận grep nhiều lần trong các audit trước) |
| `follow_up_date` (`ngay_tai_kham`) | ✅ (vừa thêm ràng buộc "phải sau ngày khám" ở phiên trước) |
| `status` | ⚠️ Có 3/4 giá trị (`cho_xac_nhan`/`da_xac_nhan`/`yeu_cau_chinh_sua`) — **thiếu `DRAFT`** |
| `doctor_revision_note` | ⚠️ Không có field riêng — hiện ghi chung vào `lich_su_sua[].noi_dung` (mảng lịch sử, không phải field đơn) |
| `doctor_confirmed_at` (`thoi_diem_xac_nhan`), `submitted_at` | ✅ có `thoi_diem_xac_nhan`; ❌ không có `submitted_at` riêng (thời điểm y tá gửi, khác với thời điểm bác sĩ xác nhận) |
| `revision_requested_at`, `revision_count` | ❌ chưa có field riêng — `lich_su_sua[]` đã lưu được thời điểm (`thoi_diem_sua`) trong mảng, đủ dùng để suy ra cả 2 nếu cần, không nhất thiết phải thêm field đếm riêng |

### 6.3 `SinhHieuKham` (VitalSigns) — đã tách model riêng đúng như spec đề xuất

Có: `can_nang`, `chieu_cao`, `huyet_ap`, `nhiet_do`, `nhip_tim`, `nguoi_do_id`, `thoi_diem_do`, `co_the_sua`, `lich_su_cap_nhat[]`.
**Thiếu so với spec**: `nhip_tho` (respiratory rate), `spo2` — 2 field spec liệt kê nhưng model chưa có. Additive-safe nếu cần thêm.

### 6.4 Invoice/Payment riêng

**Đã có** `HoaDon` + `ThanhToan` (đã audit ở phiên trước) — nhưng là "đảo" (island), chỉ dùng trong luồng Admin, **chưa từng được đọc/ghi bởi bất kỳ controller nào liên quan lịch hẹn tự đặt của bệnh nhân hay bác sĩ**. Với trang y tá: **không nên** để y tá đụng trực tiếp 2 model này (đúng nguyên tắc mục IX.6 "lễ tân/thu ngân xác nhận phần thanh toán") — y tá chỉ cần đọc `LichHen.payment_status` ở chế độ chỉ xem, không cần model Invoice/Payment riêng cho phạm vi trang y tá.

## 7. Các API đang có

**Không có API nào cho y tá.** 0 route khớp `/nurse/*`.

## 8. Các API cần bổ sung

Đúng theo mục XI — đã liệt kê chi tiết và đối chiếu với pattern code thật trong [[NURSE_DOCTOR_WORKFLOW]] mục 11/12, không lặp lại toàn bộ ở đây. Điểm bổ sung mới so với tài liệu trước: cần thêm `GET /nurse/queue?date=` **tách riêng** khỏi `GET /nurse/appointments` (spec mục III đề xuất 2 route khác nhau: hàng đợi thời gian thực vs danh sách đã check-in nói chung) — có thể dùng chung 1 controller với tham số khác nhau, không bắt buộc 2 endpoint vật lý riêng nếu muốn tối giản cho đồ án.

## 9. Luồng nghiệp vụ hiện tại đang chạy như thế nào

**Không có luồng y tá nào đang chạy.** Luồng thật hiện tại (đã audit ở tài liệu trước): bác sĩ tự làm hết — tự tạo hồ sơ, tự xác nhận hồ sơ của chính mình, không qua bước check-in/hàng đợi/tiếp nhận nào. `confirmed → completed` là 2 bước duy nhất.

## 10. Luồng nào đang sai nghiệp vụ

Không áp dụng được theo nghĩa "sai" — vì luồng y tá **chưa tồn tại để so sánh đúng/sai**. Điều cần lưu ý duy nhất: nếu xây trang y tá **mà không đồng thời sửa** `doctor/appointments.controller.js` (`createResult`/`confirmResult`), luồng bác sĩ hiện tại vẫn tự tạo+tự xác nhận hồ sơ song song với luồng y tá mới — 2 luồng ghi cùng 1 `KetQuaKham` sẽ đụng độ (unique index `appointment_id`). Đây là điểm bắt buộc phải xử lý ở bước 7-8 của kế hoạch (mục 20 dưới), không thể chỉ "thêm" mà không "sửa" route bác sĩ hiện có.

## 11. Quyền hiện tại của y tá

Không có gì — vai trò không hoạt động.

## 12. Quyền nào đang quá rộng hoặc thiếu

**Thiếu hoàn toàn** (chưa xây) — không phải "quá rộng". Rủi ro cần lưu ý trước khi xây: nếu làm ẩu, dễ mắc đúng lỗi #14 mục XVIII ("chỉ ẩn nút FE, không chặn BE") vì đây là lỗi phổ biến nhất khi thêm role mới vội — pattern đúng cần copy y hệt `doctor/appointments.controller.js`: mọi hàm phải tự tra `nurseId` từ `req.user.id`, không tin tham số nào từ client.

## 13. Dữ liệu đang hiển thị trên UI

Không có UI nào.

## 14. Dữ liệu còn thiếu

Xem bảng field-by-field mục 6. Tóm tắt phải-thêm-mới bắt buộc trước khi code chạy được: `LichHen.nurse_id`, `LichHen.checkin_time`, `LichHen.checked_in_by`, `LichHen.queue_number`, `LichHen.status` thêm `waiting_record`/`waiting_doctor_confirm`, `KetQuaKham.status` thêm `draft`, model `YTa` mới.

## 15. Logic trạng thái hiện tại

`LichHen.status`: `pending → confirmed → completed` (không qua check-in/hàng đợi). `KetQuaKham.status`: `cho_xac_nhan → da_xac_nhan | yeu_cau_chinh_sua` (không có draft, và như đã phát hiện ở audit trước: `yeu_cau_chinh_sua` hiện **không có đường quay lại `cho_xac_nhan`** sau khi sửa — bug độc lập, xem tài liệu "Sua doi - Ngay tai kham...").

## 16. Logic trạng thái sai hoặc thiếu

- Thiếu hoàn toàn 2 state trung gian `WAITING_RECORD`/`WAITING_DOCTOR_CONFIRM` ở `LichHen.status` (mục XVIII #10).
- Thiếu `DRAFT` ở `KetQuaKham.status` (mục XVIII #11) — nghĩa là hiện tại **không có khái niệm "lưu nháp"**, mọi hồ sơ tạo ra coi như gửi luôn.
- `doctor_revision_note` không phải field riêng (mục XVIII #12 — "không lưu doctor_revision_note" đúng một phần: **có lưu** nhưng lẫn trong mảng lịch sử, không phải field đơn dễ hiển thị "ghi chú yêu cầu sửa gần nhất" — đã xác nhận đây cũng là gap ở phía bác sĩ, không riêng y tá, xem tài liệu trước).

## 17. Các lỗi nghiêm trọng cần sửa trước (khi bắt đầu xây)

Không có "lỗi" vì chưa có code — nhưng có **rủi ro thiết kế nghiêm trọng cần quyết định trước khi viết dòng code đầu tiên**:
1. Phải quyết định `LichLamViec.nurse_id` gán theo **cả ngày** (1 y tá/ngày làm việc của 1 bác sĩ) hay theo ca — đã có khuyến nghị chọn "cả ngày" cho đúng độ phức tạp đồ án ở [[NURSE_DOCTOR_WORKFLOW]] mục 4.
2. Phải sửa song song `doctor/appointments.controller.js` để bác sĩ **ngừng tự tạo hồ sơ trực tiếp** một khi y tá đã nhận việc đó — nếu không, 2 actor cùng ghi 1 bảng sẽ đụng độ logic (mục 10 ở trên).

## 18. Các lỗi trung bình có thể sửa sau

Thiếu `nhip_tho`/`spo2` trên `SinhHieuKham`, thiếu `submitted_at`/`revision_count` riêng trên `KetQuaKham` — additive, không chặn luồng chính, có thể bổ sung sau khi luồng chính chạy được.

## 19. Rủi ro nếu chưa sửa (chưa xây trang y tá)

- Nếu đồ án cần demo phân vai trò rõ ràng (bác sĩ khám ≠ y tá nhập hồ sơ), **hiện tại không thể demo được** vì không có tài khoản y tá nào hoạt động.
- Nếu bị hỏi "hàng đợi khám dựa vào đâu" — câu trả lời trung thực vẫn là: **chưa có hàng đợi thật**, đúng như đã ghi trong audit lịch hẹn bác sĩ trước đó.

## 20. Kế hoạch sửa từng bước (đề xuất — CHƯA thực hiện, chờ xác nhận)

Theo đúng thứ tự mục XX, ánh xạ vào file cụ thể:

| Bước | Việc | File | Rủi ro |
|---|---|---|---|
| 1-2 | Xác nhận phạm vi, chuẩn bị role/route | `backend/src/routes/nurse/index.js` (mới, copy pattern `routes/doctor/index.js`), `backend/src/middlewares/auth.middleware.js` (không đổi, tái dùng `requireRole('nurse')`) | Thấp |
| — | Model nền tảng | `backend/src/models/YTa.js` (mới), `LichLamViec.js` (+`nurse_id`), `LichHen.js` (+`nurse_id`, +`checkin_time`, +`checked_in_by`, +`queue_number`, +2 enum status), `KetQuaKham.js` (+`draft` enum) | **Trung bình** — đổi enum ảnh hưởng dữ liệu cũ, cần kiểm tra data hiện có trước khi deploy (đã cảnh báo ở [[NURSE_DOCTOR_WORKFLOW]] mục 18) |
| 3-5 | Dashboard, hàng đợi, chi tiết | `backend/src/controllers/nurse/*.js` (mới), `frontend/src/pages/nurse/*.tsx` (mới), `frontend/src/layouts/NurseLayout.jsx` (mới) | Thấp — file mới hoàn toàn |
| 6-9 | Tiếp nhận/vital signs, form hồ sơ, gửi xác nhận, hồ sơ cần sửa | Controller/page mới + **sửa `doctor/appointments.controller.js`** (`createResult`/`confirmResult`/`requestResultRevision`) để chuyển quyền tạo hồ sơ ban đầu sang y tá, bác sĩ chỉ còn xác nhận/yêu cầu sửa | **Trung bình-cao** — đây là thay đổi hành vi của route bác sĩ đang chạy tốt, phải test kỹ để không phá luồng hiện tại (mục 17.2) |
| 10-11 | Chặn sửa hồ sơ đã CONFIRMED, chặn thanh toán/giá/hủy lịch | Validation trong controller mới, không đụng route bác sĩ/admin | Thấp |
| 12-14 | Seed data, test case, kiểm tra lại với trang bác sĩ | `backend/src/scripts/seed-doctor-test-data.js` (mở rộng) hoặc script mới, test file mới | Thấp |

## 21. Danh sách test case cần chạy

15 test case mục XVII — chưa có test nào để chạy vì chưa có code. Khi implement, viết theo đúng thứ tự bảng đó, ưu tiên test #6, #8, #11, #12 (test chặn quyền/trạng thái sai) trước test hiển thị (#1-3) vì đây là nơi dễ để lọt lỗi bảo mật nhất.

## 22. Kết luận: trang y tá đã đủ chuẩn để bảo vệ đồ án chưa?

**Chưa — vì chưa tồn tại.** Nhưng nền tảng dữ liệu để xây (model `SinhHieuKham`, `KetQuaKham`, `DonThuoc`, `PhongKham`) đã có sẵn và khớp phần lớn với thiết kế mong muốn — đây là điểm thuận lợi, khối lượng việc còn lại chủ yếu là **route/controller/frontend mới + vài field bổ sung**, không phải thiết kế lại từ đầu. Rủi ro lớn nhất không phải là "làm nhiều" mà là **quên đồng bộ với route bác sĩ đang chạy** (mục 17.2) khi chuyển quyền tạo hồ sơ từ bác sĩ sang y tá.

---
*Chờ bạn xác nhận bắt đầu từ bước nào trong mục 20 trước khi tôi sửa code — theo đúng nguyên tắc mục XXI.*
