# Audit — Chức năng "Lịch hẹn của bác sĩ" đối chiếu với đặc tả nghiệp vụ đầy đủ (mục I–XII)

> Phạm vi: chỉ chức năng **Lịch hẹn bác sĩ** (`/doctor/appointments*`), không mở rộng sang y tá/lễ tân/admin.
> Đã đọc trực tiếp code hiện tại (không suy đoán từ tài liệu cũ) trước khi viết báo cáo này. **Chưa sửa gì** — đúng yêu cầu mục XII.
> Đọc kèm: [[Phan tich - Chuc nang xac nhan ho so kham (2026-07-10)]], [[NURSE_DOCTOR_WORKFLOW]], [[Audit - Truong du lieu thieu va thua trong DB (2026-07-08)]], [[Phan tich - Luong Lich hen - Checkin - Hang doi - Kham - Xac nhan - Thanh toan (2026-07-11)]].

---

## Nhận định tổng quát trước khi đi vào chi tiết

Đặc tả mục III/IV giả định một **máy trạng thái 8 bước** (`NOT_CHECKED_IN → CHECKED_IN → WAITING → IN_PROGRESS → WAITING_RECORD → WAITING_DOCTOR_CONFIRM → WAITING_PAYMENT → COMPLETED`) tách biệt hẳn với `appointment_status`.

**Thực tế code hiện tại chỉ có 2 trạng thái vận hành**: `confirmed → completed`, bấm thẳng bởi bác sĩ, **không qua check-in, không qua "bắt đầu khám" riêng, không có hàng đợi**. Đây không phải lỗi cài sai — đây là **tính năng chưa được xây** (check-in/hàng đợi/y tá hoàn toàn không tồn tại trong code, đã xác nhận lại bằng grep `checked_in|checkin` — chỉ khớp ở định nghĩa enum chết và 1 script seed, không có route/controller nào dùng). Điều này đã được ghi nhận trong [[NURSE_DOCTOR_WORKFLOW]] — tài liệu đó **đã thiết kế sẵn** đúng máy trạng thái đặc tả yêu cầu, chỉ chưa triển khai.

→ Phần lớn câu hỏi ở mục III ("bác sĩ có bấm được X khi chưa Y không") **không áp dụng được** vì bước Y chưa tồn tại để kiểm tra thứ tự — không phải "kiểm tra thấy sai" mà là "chức năng chưa có để sai".

---

## 1. Tổng quan chức năng lịch hẹn bác sĩ hiện tại

Bác sĩ đăng nhập → `/doctor/appointments` (`DoctorAppointments.tsx`) → xem danh sách lịch hẹn của chính mình, lọc theo ngày/trạng thái → mở rộng 1 dòng để xem chi tiết (không có trang `/doctor/appointments/:id` riêng — chi tiết render inline ngay trong bảng, dạng expand-row, không phải route riêng). Từ đó thao tác: xác nhận/từ chối (chỉ home, pending), hoàn thành, hủy, nhập/xem/sửa kết quả khám, xác nhận hồ sơ hoặc yêu cầu chỉnh sửa. Có 1 trang phụ `DoctorPendingRecords.tsx` (chỉ xem danh sách hồ sơ chờ xác nhận, không có nút hành động — đã ghi nhận là UX lệch tên trang trong [[Phan tich - Chuc nang xac nhan ho so kham (2026-07-10)]]).

## 2. Các file frontend liên quan

| File | Vai trò |
|---|---|
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Trang chính — danh sách + chi tiết (expand row) + mọi action + `ExamModal` + `ReasonModal` |
| `frontend/src/pages/doctor/DoctorPendingRecords.tsx` | Danh sách hồ sơ `cho_xac_nhan`, chỉ xem |
| `frontend/src/services/doctor-appointment.service.ts` | Gọi 7 API: getAll, getById, confirm, complete, reject/cancelConfirmed (cùng 1 endpoint `/cancel`), confirmResult, requestResultRevision, listPendingResults |
| `frontend/src/services/examination.service.ts` | `getByAppointment` (GET result, 404→null), `save` (POST, fallback PUT nếu 409) — **đã gọi API thật**, không còn mock in-memory |
| `frontend/src/types/index.ts` | `AppointmentStatus` (4 giá trị), `PaymentStatus` (4 giá trị), `KetQuaKhamStatus` (3 giá trị), `DoctorAppointmentDetail`, `DoctorPendingRecord`, `ExaminationResult` |

Không có `AppointmentDetail.tsx` riêng cho bác sĩ (khác với `pages/admin/ManageAppointments/AppointmentDetail.tsx` — đó là của admin, không dùng chung).

## 3. Các file backend liên quan

| File | Vai trò |
|---|---|
| `backend/src/routes/doctor/index.js` | Mount `verifyToken, requireRole('doctor')` cho **toàn bộ** `/api/doctor/*` (dòng 15) |
| `backend/src/routes/doctor/appointments.routes.js` | 10 route: `GET /`, `GET /pending-results`, `GET /:id`, `PATCH /:id/confirm`, `/cancel`, `/complete`, `GET/POST/PUT /:id/result`, `PATCH /:id/result/confirm`, `/result/request-revision` |
| `backend/src/controllers/doctor/appointments.controller.js` | Toàn bộ logic — 404 lines, đã đọc đầy đủ |
| `backend/src/middlewares/auth.middleware.js` | `verifyToken` (giải JWT → `req.user`), `requireRole(...roles)` |
| `backend/src/services/appointmentAutoCancel.service.js` | Cron: tự hủy lịch HOME `confirmed+unpaid` quá `payment_deadline` |

## 4. Các model/database liên quan

| Model | Field liên quan lịch hẹn bác sĩ |
|---|---|
| `LichHen` | `doctor_id`, `status` (enum 7 giá trị, chỉ 4 giá trị thực sự dùng), `payment_status` (4 giá trị), `loai_kham` (`clinic`/`home`), `payment_deadline`, `ly_do_huy`, `schedule_id`+`slot_id` |
| `KetQuaKham` | `appointment_id` (unique), `status` (3 giá trị), `co_the_sua`, `nguoi_nhap_id`, `bac_si_phu_trach_id`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan`, `lich_su_sua[]`, `dich_vu_phat_sinh[]` (Mixed, **không ai ghi**) |
| `BacSi` | Tra `docId` từ `user_id` (`getDocId()`) — mọi endpoint đều qua bước này, không tin `doctorId` từ FE |
| `ThanhVien`, `NguoiDung` | Nguồn dữ liệu bệnh nhân join vào `formatAppointment()` |
| `LichLamViec` | Chỉ dùng để mở lại/khóa `slot` khi hủy — không có `nurse_id`, không có FK phòng thật (`phong_kham` là String tự do) |

**Không có** model `HoaDon`/`ThanhToan` nào được đọc bởi trang lịch hẹn bác sĩ — thanh toán chỉ hiển thị qua `LichHen.payment_status` (đúng yêu cầu "chỉ xem", vì bác sĩ không có API nào ghi field này).

## 5. Các API đang có (đối chiếu mục V của đặc tả)

| API đặc tả yêu cầu | Có thật không | Ghi chú |
|---|---|---|
| `GET /doctor/appointments` | ✅ | Lọc `doctor_id` từ token, lọc `status`+`date` qua query, populate `specialty_id` |
| `GET /doctor/appointments/:id` | ✅ | `findOne({_id, doctor_id: docId})` → 404 nếu không thuộc bác sĩ này (đúng, xem mục 11) |
| `PATCH /:id/start` (→ IN_PROGRESS) | ❌ **không tồn tại** | Không có bước "bắt đầu khám" tách riêng |
| `PATCH /:id/finish-exam` (→ WAITING_RECORD) | ⚠️ **có nhưng khác tên và khác đích đến** | `complete()` chuyển thẳng `confirmed → completed`, không qua `WAITING_RECORD` |
| `GET /doctor/medical-records/pending` | ⚠️ có, khác đường dẫn | Thực tế: `GET /doctor/appointments/pending-results` |
| `PATCH /doctor/medical-records/:id/confirm` | ⚠️ có, khác đường dẫn | Thực tế: `PATCH /doctor/appointments/:id/result/confirm` |
| `PATCH /doctor/medical-records/:id/request-revision` | ⚠️ có, khác đường dẫn | Thực tế: `PATCH /doctor/appointments/:id/result/request-revision` |
| API check-in | ❌ không tồn tại (đúng thiết kế — việc của y tá/lễ tân, chưa triển khai role đó) | |
| API payment (bác sĩ) | ❌ không tồn tại (đúng — bác sĩ không được sửa thanh toán) | |

## 6. Dữ liệu đang hiển thị trên UI

Có: giờ khám, ngày khám, mã lịch hẹn, tên bệnh nhân, tuổi/giới tính, dịch vụ, chuyên khoa (chi tiết), phòng khám (clinic)/địa chỉ (home), SĐT, phí khám, thanh toán (badge, chỉ xem), trạng thái lịch hẹn, lý do khám, lý do hủy, dị ứng/bệnh nền (nếu có member_id), hồ sơ khám (badge trạng thái + nút xem/xác nhận/yêu cầu sửa khi có).

## 7. Dữ liệu còn thiếu (đối chiếu mục II.1 và II.3 của đặc tả)

| Thiếu | Vì sao |
|---|---|
| Giờ check-in | Field không tồn tại trong `LichHen` (`checkin_time`, `checked_in_by` — không có trong schema) |
| Y tá hỗ trợ | Cột "Y tá" **hard-code chuỗi tĩnh** "Chưa phân công y tá" (`DoctorAppointments.tsx:602-605`) — không đọc DB vì không có field `nurse_id` |
| Nguồn đặt lịch (ONLINE/PHONE/WALK_IN) | Không có field `booking_source` — chỉ có `loai_kham` (clinic/home, khác chiều với online/phone/walk-in) và cờ `dat_ho` |
| Tiền sử bệnh, thuốc đang dùng, ghi chú đặc biệt | `ThanhVien` model chỉ có `di_ung`, `benh_nen` — không có `tien_su_benh`, `thuoc_dang_dung`, `ghi_chu_dac_biet` (chưa verify field `ThanhVien` đầy đủ trong lần đọc này, nhưng `formatAppointment()` chỉ select 2 field này nên chắc chắn không hiển thị dù model có) |
| Thời gian đặt lịch (`ngay_tao`) | Có trong schema (`timestamps`) nhưng `formatAppointment()` không trả field này ra FE |

## 8. Logic trạng thái hiện tại

```
HOME:   pending --(bác sĩ confirm, set payment_deadline=+2h nếu unpaid)--> confirmed --(bác sĩ complete)--> completed
                \--(bác sĩ reject, chỉ khi pending)--> cancelled
                                confirmed --(cron auto-cancel nếu unpaid quá payment_deadline)--> cancelled
                                confirmed --(bác sĩ hủy khẩn cấp, bắt buộc lý do)--> cancelled (nếu paid → refunded)

CLINIC: confirmed (auto-confirm khi thanh toán — không qua pending, quyết định 2026-07-02)
                --(bác sĩ complete)--> completed
                --(bác sĩ hủy khẩn cấp)--> cancelled, slot → 'locked' (không mở lại)
```

`KetQuaKham.status`: `cho_xac_nhan` (mặc định khi tạo) → `da_xac_nhan` (confirm) hoặc `yeu_cau_chinh_sua` (request-revision, có thể sửa lại nhưng **không có API nào đưa nó về `cho_xac_nhan`** — xem mục 9).

## 9. Logic trạng thái sai hoặc thiếu

| # | Vấn đề | Mức độ |
|---|---|---|
| 1 | Sau `yeu_cau_chinh_sua`, không có endpoint nào chuyển hồ sơ về `cho_xac_nhan` lại. `updateResult()` chỉ sửa nội dung (`chan_doan`, `huong_dan_dieu_tri`...), **không đổi `status`**. → hồ sơ bị "yêu cầu sửa" rồi mãi mãi kẹt ở `yeu_cau_chinh_sua`, kể cả sau khi bác sĩ tự sửa lại xong. | **Nghiêm trọng** — vì hiện tại người sửa và người yêu cầu sửa là cùng 1 bác sĩ (chưa có y tá), lỗi này chưa gây hại thấy rõ, nhưng là bug thật, độc lập với việc có y tá hay không |
| 2 | `PAYMENT_DEADLINE_HOURS = 2` (giờ), không phải "15 phút" như mục III.9/nguyên tắc đặc tả giả định | Không phải bug — nhưng đặc tả và code hiện tại **không khớp con số**, cần đối chiếu lại yêu cầu thật với nhóm trước khi lấy "15 phút" làm chuẩn để test |
| 3 | Không có bước `IN_PROGRESS`/"bắt đầu khám" — `complete()` chuyển thẳng `confirmed → completed` bất kể đã "bắt đầu khám" hay chưa | Thiếu tính năng (theo thiết kế [[NURSE_DOCTOR_WORKFLOW]] mục 8, đã có kế hoạch, chưa làm) |
| 4 | `createResult()` cho phép nhập kết quả cả khi `status` đã `completed` — nghĩa là "Hoàn thành" và "có hồ sơ khám" là 2 việc độc lập, bác sĩ có thể hoàn thành trước, nhập hồ sơ sau tùy ý, không ép thứ tự | Chủ đích (có comment giải thích), không phải lỗi, nhưng khác với mục III.4 yêu cầu "WAITING_RECORD" là trạng thái bắt buộc phải qua |
| 5 | `dich_vu_phat_sinh` chưa từng được ghi bởi bất kỳ controller nào (kể cả `createResult`/`updateResult` hiện tại) → điều kiện `WAITING_PAYMENT` (đã thêm ở lần sửa trước, xem [[Phan tich - Luong Lich hen - Checkin - Hang doi - Kham - Xac nhan - Thanh toan (2026-07-11)]] mục 13) **luôn đúng là mảng rỗng** → hồ sơ luôn auto-complete, không bao giờ rơi vào `WAITING_PAYMENT` thực tế | Đã biết, đã ghi nhận là "dormant" trong tài liệu trước |

## 10. Các quyền thao tác hiện tại của bác sĩ

Xem, xác nhận (home/pending), từ chối (home/pending), hủy khẩn cấp (confirmed), hoàn thành, nhập/sửa/xem kết quả khám, xác nhận/yêu cầu sửa hồ sơ khám — **toàn bộ đều tự giới hạn đúng vào `doctor_id = docId` suy từ token** (`getDocId(req.user.id)` gọi trong **mọi** hàm, không có ngoại lệ).

## 11. Quyền nào đang sai nghiệp vụ

**Không tìm thấy vi phạm quyền nào.** Đối chiếu cụ thể mục VI của đặc tả:

- Bác sĩ chỉ vào được route `doctor` — ✅ `requireRole('doctor')` áp dụng toàn cục ở `routes/doctor/index.js:15`.
- Không tin `doctorId` từ FE — ✅ mọi hàm đều `getDocId(req.user.id)`, không đọc `req.body.doctor_id` hay `req.query.doctorId` ở đâu cả.
- Không xem được lịch bác sĩ khác — ✅ `findOne({_id, doctor_id: docId})` → trả 404 (không phải 403, nhưng hiệu quả tương đương: không rò rỉ dữ liệu, chỉ khác mã lỗi so với đặc tả yêu cầu "403/404" — đặc tả chấp nhận cả 2).
- Không sửa được `payment_status` — ✅ grep toàn bộ `appointments.controller.js`: chỉ có 1 chỗ set `payment_status = 'refunded'` (trong `cancel()`, khi bác sĩ hủy và trước đó đã `paid` — đây là **hệ quả tất yếu của việc hủy**, không phải bác sĩ "xác nhận thanh toán" tùy ý) — không có endpoint nào set `payment_status = 'paid'`.
- Không check-in được bệnh nhân — ✅ vì API check-in không tồn tại (không phải do bị chặn, mà do chưa được xây — không có nguy cơ "bác sĩ lỡ check-in" vì nút/API đó chưa tồn tại).

## 12. Các lỗi nghiêm trọng cần sửa trước

1. **Hồ sơ `yeu_cau_chinh_sua` không có đường quay lại `cho_xac_nhan`** (mục 9.1) — đây là lỗi thật, độc lập với module y tá, nên sửa sớm bất kể có làm y tá hay không, vì nếu để vậy khi có module y tá thật thì luồng "y tá sửa xong gửi lại" sẽ bị kẹt hoàn toàn.

## 13. Các lỗi trung bình nên sửa sau

1. Đặt tên route lệch với đặc tả (`/pending-results` thay vì `/medical-records/pending`, v.v.) — không sai chức năng, chỉ là quy ước đặt tên; không cần đổi nếu FE/BE đã khớp nhau, chỉ cần lưu ý khi viết tài liệu API để tránh nhầm khi bàn giao.
2. `formatAppointment()` không trả `ngay_tao` (thời gian đặt lịch) — đặc tả mục II.3.B yêu cầu hiển thị, hiện thiếu.
3. "Y tá hỗ trợ" hard-code text tĩnh thay vì field thật — chờ quyết định có làm module y tá hay không (đã có thiết kế sẵn ở [[NURSE_DOCTOR_WORKFLOW]]).

## 14. Các rủi ro có thể để lại nếu chưa đủ thời gian

- Nếu bảo vệ đồ án bị hỏi "hàng đợi khám dựa trên gì" — câu trả lời trung thực là **hệ thống hiện tại không có hàng đợi, thứ tự khám là danh sách tĩnh sắp theo `gio_kham`** (client-side sort trong `DoctorAppointments.tsx:349`), không phải giờ đến thực tế. Cần chuẩn bị câu trả lời rõ ràng thay vì để giám khảo tự phát hiện.
- Nếu demo yêu cầu "bác sĩ xác nhận hồ sơ do y tá nhập" — hiện tại **1 bác sĩ tự nhập tự xác nhận**, không thể demo phân vai trò thật vì không có tài khoản y tá nào hoạt động được.
- Bug mục 9.1 (`yeu_cau_chinh_sua` kẹt vĩnh viễn) nếu bị giám khảo test tay (yêu cầu sửa → sửa lại → hỏi "giờ trạng thái là gì") sẽ lộ ngay vì UI vẫn hiện badge "Cần chỉnh sửa" dù nội dung đã sửa xong.

## 15. Kế hoạch sửa từng bước (chỉ đề xuất — CHƯA thực hiện)

Theo đúng thứ tự ưu tiên mục XII, áp dụng riêng cho phạm vi lịch hẹn bác sĩ (bỏ qua các bước không liên quan như "sửa phân quyền" vì mục 11 xác nhận không có vi phạm):

| Bước | File | Lý do | Cách sửa dự kiến | Rủi ro |
|---|---|---|---|---|
| 1 | `backend/src/controllers/doctor/appointments.controller.js` (`requestResultRevision`, thêm endpoint mới hoặc sửa `updateResult`) | Bug mục 12.1 — hồ sơ kẹt `yeu_cau_chinh_sua` | Sau khi bác sĩ `updateResult()` thành công trên hồ sơ đang `yeu_cau_chinh_sua`, tự chuyển `status` về `cho_xac_nhan` (để về lại vòng xác nhận) | Thấp — chỉ thêm 1 dòng set status trong nhánh đã có sẵn |
| 2 | `formatAppointment()` | Thiếu `ngay_tao` (mục 13.2) | Thêm field vào object trả về, đã có sẵn trong `timestamps` | Rất thấp |
| 3 | (Quyết định trước, chưa code) | Có làm module check-in/hàng đợi/y tá hay không | Nếu có: theo đúng kế hoạch đã thiết kế sẵn ở [[NURSE_DOCTOR_WORKFLOW]] mục 18. Nếu không: giữ nguyên, nhưng nên sửa lại text mô tả trong đặc tả/tài liệu bảo vệ đồ án để không tự mâu thuẫn với thực tế | N/A — quyết định phạm vi, không phải sửa code |

## 16. Danh sách test case cần chạy

Đối chiếu 16/16 test case mục X của đặc tả với hệ thống hiện tại:

| # | Test case | Áp dụng được không | Kết quả dự kiến |
|---|---|---|---|
| 1 | Xem danh sách lịch hẹn hôm nay | ✅ | Pass — đã verify logic lọc `doctor_id` |
| 2 | Xem chi tiết lịch hẹn | ✅ | Pass — không có nút sửa thanh toán |
| 3 | Chưa check-in không bấm được bắt đầu khám | ❌ N/A | Không có khái niệm check-in/bắt đầu khám tách riêng |
| 4 | Đã check-in bấm được bắt đầu khám | ❌ N/A | Như trên |
| 5 | Đang khám bấm được kết thúc khám | ❌ N/A | Không có trạng thái "đang khám" |
| 6 | Kết thúc khám → `WAITING_RECORD`, không thẳng `COMPLETED` | ❌ **Fail theo đặc tả** | Thực tế `complete()` chuyển thẳng `completed` — đây là thiết kế khác, không phải lỗi cần "fix" nếu chưa quyết định làm y tá |
| 7 | Y tá gửi hồ sơ → bác sĩ thấy chờ xác nhận | ⚠️ Một phần | `KetQuaKham.status` hoạt động đúng, nhưng "y tá gửi" không tồn tại — chính bác sĩ tạo luôn ở `cho_xac_nhan` |
| 8 | Xác nhận hồ sơ không phát sinh chi phí → `COMPLETED` | ✅ Pass | Đã verify code — nhưng lưu ý `dich_vu_phat_sinh` luôn rỗng nên **case 9 không bao giờ xảy ra thực tế** |
| 9 | Xác nhận hồ sơ có phát sinh chi phí → `WAITING_PAYMENT` | ⚠️ Code đúng nhưng **không thể test được** vì không có đường nào ghi `dich_vu_phat_sinh` |
| 10 | Yêu cầu sửa hồ sơ → `NEED_REVISION` + note | ⚠️ Một phần | Chuyển status đúng, lưu `lich_su_sua` đúng, nhưng **không có `doctor_revision_note` field riêng** (dùng chung `lich_su_sua[].noi_dung`) — và **bug mục 12.1**: không có đường quay lại sau khi sửa |
| 11 | Lịch online chưa thanh toán không được xử lý như hợp lệ | ✅ Pass (cho HOME) | `confirm()`/`complete()` không chặn theo `payment_status`, nhưng UI hiện cảnh báo rõ khi `confirmed+unpaid` (dòng 704-718) — **lưu ý: `complete()` backend KHÔNG chặn hoàn thành dù chưa thanh toán** — cần verify lại xem đây có phải lỗ hổng nghiệp vụ hay chủ đích (bác sĩ khám nhà rồi thu tiền sau) |
| 12 | Quá hạn thanh toán → `CANCELLED`/`EXPIRED`, không hiển thị như lịch chính | ✅ Pass | Cron `appointmentAutoCancel.service.js` xử lý đúng, có mở lại slot (đã sửa ở phiên trước) |
| 13 | Phone booking chưa thanh toán không fake `PAID` | ⚠️ N/A khái niệm | Không có `booking_source = PHONE` riêng biệt trong model hiện tại |
| 14 | Walk-in có `booking_source`, `checkin_time`, `queue_number` | ❌ N/A | Cả 3 field đều không tồn tại |
| 15 | Bác sĩ xem lịch bác sĩ khác → 403/404 | ✅ Pass | Trả 404 (đã verify code, xem mục 11) |
| 16 | Bác sĩ sửa `payment_status` → bị chặn backend | ✅ Pass | Không có endpoint nào cho phép FE truyền `payment_status` tùy ý |

**7/16 pass thật, 1 fail thật đáng chú ý (case 9, do case 5 nguyên nhân gốc), 8 không áp dụng được vì tính năng chưa tồn tại** (không phải lỗi implement sai).

Test case bổ sung nên viết cho bug đã tìm thấy (mục 12.1):
- **TC-17**: Bác sĩ yêu cầu chỉnh sửa hồ sơ (`yeu_cau_chinh_sua`) → gọi `PUT /:id/result` sửa nội dung → kỳ vọng `status` có đổi lại `cho_xac_nhan`? (hiện tại: **không đổi**, đây là bug cần xác nhận với nhóm có đúng là bug hay chủ ý "phải bấm nút riêng để gửi lại" mà nút đó chưa tồn tại).

## 17. Kết luận: chức năng lịch hẹn bác sĩ đã đủ bảo vệ đồ án chưa?

**Đủ ở phần đã làm, nhưng cần chuẩn bị lời giải thích rõ ràng cho phần chưa làm — không nên im lặng nếu bị hỏi.**

- Phần đã làm (xác nhận, hủy, hoàn thành, nhập/xác nhận hồ sơ, phân quyền theo token) **chắc chắn, đã verify từng dòng code, không có lỗ hổng bảo mật hay rò rỉ dữ liệu bác sĩ khác**.
- Phần "hàng đợi/check-in/y tá" theo đúng đặc tả **chưa tồn tại** — nhưng đã có thiết kế đầy đủ sẵn sàng triển khai ([[NURSE_DOCTOR_WORKFLOW]]), nên khi bị hỏi có thể trả lời bằng lộ trình thay vì "chưa nghĩ tới".
- 1 bug thật cần sửa trước khi bảo vệ (mục 12.1) vì dễ bị phát hiện khi test tay trực tiếp và không liên quan gì đến việc có làm y tá hay không.

---
*Ghi chú tuân thủ mục XII: báo cáo này chỉ khoanh vùng + phân tích + đề xuất, chưa sửa file nào. Chờ xác nhận trước khi thực hiện bước 1 ở mục 15.*
