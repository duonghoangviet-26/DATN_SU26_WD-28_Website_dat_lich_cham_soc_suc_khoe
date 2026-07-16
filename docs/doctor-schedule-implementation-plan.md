# Kế hoạch triển khai sửa "Lịch làm việc bác sĩ" (cho các prompt SAU)

> Ngày lập: **2026-07-13**. Đọc kèm: `doctor-schedule-analysis-report.md`,
> `doctor-schedule-database-gap-analysis.md`.
> Nguyên tắc xuyên suốt: ưu tiên **không đụng model**; giữ **mock data** tới khi API thật xong;
> **không tự commit/push** (theo memory dự án); mỗi bước có điều kiện bắt đầu/hoàn thành + rollback.

---

## ✅ Tiến độ (cập nhật 2026-07-13 — sau Prompt 2)

| Bước | Trạng thái |
|---|---|
| Bước 1 — Chuẩn hóa response API (nurse, trạng thái ngày) | ✅ **Xong** (backend) |
| Bước 2 — API danh sách lịch (tuần + đếm lịch hẹn) | ✅ **Xong** — hỗ trợ `from/to` (đã có) + đếm ở chi tiết ca; tránh N+1 |
| Bước 3 — API chi tiết ca | ✅ **Xong** — `GET /doctor/schedule/:scheduleId` |
| Bước 4 — Logic lịch hẹn còn hiệu lực | ✅ **Xong** — `utils/appointmentStatus.js` |
| Bước 5 — Sức chứa | ⏸ **Bỏ qua** (không đủ mô hình dữ liệu — giữ trong gap, không hardcode) |
| Bước 6 — API danh sách nghỉ (+ghi_chu) | ✅ **Xong** |
| Bước 7 — API tạo nghỉ (chống trùng + đếm ảnh hưởng) | ✅ **Xong** |
| Bước 8 — API rút nghỉ | ✅ **Đã đúng từ trước** (ownership + status guard) — thêm test |
| Bước 9 — Kiểm tra bảo mật | ✅ **Xong** — test cross-doctor (404) cho cả ca lẫn đơn nghỉ |
| Bước 10 — Hồi quy | ✅ **Xong** — full suite 22/25 pass; 3 fail là pre-existing (appointments seed drift) |
| Bước 4 — FE lịch tuần + điều hướng | ✅ **Xong** — Tuần trước/Tuần sau/Hôm nay, xem được quá khứ (chỉ đọc) |
| Bước 5 — FE chi tiết ca + y tá thật | ✅ **Xong** — modal chi tiết + bỏ hardcode y tá (xác nhận qua Playwright) |
| Bước 6 — FE đồng bộ yêu cầu nghỉ (GAP-5) | ✅ **Xong** — đối chiếu thật với `GET /doctor/leaves`, hiện `ghi_chu` Admin |
| Bước 7 — Loại bỏ mock | ✅ **Xong** — xóa `mock/doctor-schedule.ts` (xác nhận 0 import trước khi xóa) |
| Bước 9–10 (FE) — Test + hồi quy | ✅ **Xong** — 37/37 test FE pass, build pass, kiểm thử trình duyệt thật (Playwright, 0 console error) |

**File backend đã sửa/tạo ở Prompt 2**: `controllers/doctor/schedule.controller.js`,
`controllers/doctor/leaves.controller.js`, `routes/doctor/schedule.routes.js`,
`utils/appointmentStatus.js` (mới), `tests/doctor.schedule.test.js` (mới).

**File frontend đã sửa/tạo ở Prompt 3**: `pages/doctor/DoctorSchedule.tsx` (viết lại phần lớn),
`pages/doctor/DoctorLeaveRequests.tsx` (thêm hiện `ghi_chu`), `services/schedule.service.ts`
(+`getDetail`, +AbortSignal), `types/index.ts` (+7 type/field mới cho Doctor Panel, **và 1 fix cú
pháp chặn `tsc` toàn dự án — xem J.4 report**), `utils/constants.ts` (+2 map trạng thái ngày),
`utils/scheduleWeek.ts` (mới — logic thuần, tách để test), `__tests__/services/schedule.service.test.ts`,
`__tests__/services/doctor-leave.service.test.ts`, `__tests__/utils/scheduleWeek.test.ts` (3 file test mới).
Đã xóa `mock/doctor-schedule.ts` (dead code).

**File backend đã sửa ở Prompt 3** (lỗi nhỏ đã xác nhận, báo cáo trước — xem report mục J.2):
`controllers/doctor/schedule.controller.js` — sửa cách đọc/ghi ngày (local time thay vì UTC) để
đối xứng với cách `ngay` được lưu, tránh lệch 1 ngày khi chạy ở múi giờ khác UTC.

**Rủi ro còn lại**:
(a) 3 test appointments fail do seed drift — nên chạy lại `seed-doctor-test-data.js` nếu muốn xanh
toàn bộ (ngoài phạm vi Lịch làm việc);
(b) **[MỚI, ưu tiên cao]** phát hiện 2 document `LichLamViec` trùng ngày lịch cho `doctor.test`
(2026-07-13 → 07-17) — bất thường dữ liệu thật, đã xử lý an toàn ở tầng hiển thị (cảnh báo, tách
riêng, không đoán), nhưng **cần Admin/backend điều tra và xử lý gốc** trước khi làm thêm tính năng
sâu vào lịch làm việc (xem `doctor-schedule-database-gap-analysis.md` mục H/GAP-8);
(c) ~90 lỗi `tsc` pre-existing không liên quan (ServiceItem/AppointmentItem/PaymentItem/mock
doctor-appointments) — không thuộc phạm vi Lịch làm việc, chưa sửa, đã báo cáo rõ.

**Điều kiện bắt đầu Prompt 4**: Cần trước tiên (a) Admin/backend xác nhận hướng xử lý GAP-8 (dữ
liệu trùng), vì Prompt 4 (hoàn thiện yêu cầu nghỉ + phân quyền sâu hơn) có thể bị ảnh hưởng bởi dữ
liệu không nhất quán. Về mặt code: API + FE đã ổn định, test xanh, build xanh, đã kiểm thử trình
duyệt thật — sẵn sàng về mặt kỹ thuật.

---

## Bước 1 — Chuẩn hóa response API lịch làm việc (thêm dữ liệu đã có trong DB)

- **Phạm vi**: mở rộng `flattenSchedules()` / `getSchedules()` để trả thêm `nurse_id` (populate
  `ho_ten`), `trang_thai_ngay`, `chi_nhanh_id`, và (nếu quyết) `lock_expires_at`.
- **File dự kiến sửa**: `backend/src/controllers/doctor/schedule.controller.js`.
- **File chỉ đọc**: `models/LichLamViec.js`, `models/NguoiDung.js`.
- **File KHÔNG đụng**: mọi model (không thêm field), `scheduleGenerator.service.js`, admin/*.
- **Mục tiêu**: FE có dữ liệu y tá/trạng thái ngày thật.
- **Điều kiện bắt đầu**: chốt danh sách field cần trả.
- **Điều kiện hoàn thành**: response chứa `nurse` (tên) + `nurse_id`; test GET trả đúng.
- **Rủi ro**: đổi shape response → FE cũ phải cập nhật đồng bộ (làm cùng Bước 4).
- **Test**: gọi `GET /api/doctor/schedule?from&to` với bác sĩ Khang → kỳ vọng `nurse` = "Điều dưỡng
  Thanh Hà" ở các slot/ngày đã gắn; bác sĩ chưa gắn → `null`.
- **Rollback**: revert controller (không ảnh hưởng dữ liệu).

## Bước 2 — Hoàn thiện API danh sách lịch (tuần + đếm lịch hẹn)

- **Phạm vi**: hỗ trợ truy vấn theo **tuần bất kỳ** (from/to đã có); thêm đếm "số lịch hẹn/ca"
  (GAP-4) bằng aggregate `LichHen` theo `schedule_id` (đếm động, **không thêm field**).
- **File dự kiến sửa**: `backend/src/controllers/doctor/schedule.controller.js` (+ có thể tách
  helper trong cùng file).
- **File chỉ đọc**: `models/LichHen.js`.
- **KHÔNG đụng**: model, generator, admin.
- **Mục tiêu**: API phục vụ được màn tuần và hiển thị số lịch hẹn mỗi ca.
- **Điều kiện hoàn thành**: response mỗi ngày/ca kèm `so_lich_hen`; test đếm khớp dữ liệu Khang.
- **Rủi ro**: aggregate sai khi slot rỗng → cần test ngày 07-15 (đầy) và ngày trống.
- **Test**: ngày 07-15 (Khang) → `so_lich_hen` khớp số slot booked; ngày không có lịch hẹn → 0.
- **Rollback**: revert controller.

## Bước 3 — API chi tiết ca (danh sách bệnh nhân + liên kết lịch hẹn)

- **Phạm vi**: endpoint MỚI (chỉ đọc) trả chi tiết 1 ca: slot, phòng, y tá, danh sách `LichHen`
  thuộc ca (join tên BN kể cả `ten_khach` cho khách offline — GAP-7).
- **File dự kiến sửa**: `schedule.controller.js` + `routes/doctor/schedule.routes.js` (thêm 1 GET),
  `services/schedule.service.ts` (thêm hàm), `types/index.ts` (thêm type chi tiết ca).
- **File chỉ đọc**: `models/LichHen.js`, `models/KhachVangLai.js`.
- **KHÔNG đụng**: model schema, quyền (giữ ownership `doctor_id` từ token).
- **Mục tiêu**: mở được chi tiết ca, thấy đủ bệnh nhân online/offline.
- **Điều kiện hoàn thành**: GET chi tiết ca của bác sĩ khác → 404/403; của mình → đúng danh sách.
- **Rủi ro**: rò rỉ dữ liệu BN → chỉ trả field cần, che số điện thoại/email nếu không cần.
- **Test**: bác sĩ Khang mở ca có 1 BN tài khoản + khách vãng lai → cả hai đều hiện tên.
- **Rollback**: xóa endpoint mới + revert route/service/type.

## Bước 4 — Frontend: chuyển sang lịch tuần + điều hướng

- **Phạm vi**: thay "6 ngày cố định" bằng **lịch tuần** có nút Tuần trước / Tuần sau / Hôm nay;
  cho xem **quá khứ ở chế độ chỉ đọc** (không ẩn hoàn toàn ngày cũ).
- **File dự kiến sửa**: `frontend/src/pages/doctor/DoctorSchedule.tsx`,
  `frontend/src/utils/format.ts` (nếu cần helper tuần), `services/schedule.service.ts` (đã có from/to).
- **File chỉ đọc**: `constants.ts`, `types/index.ts`.
- **KHÔNG đụng**: backend (đã xong Bước 1–2), admin, generator.
- **Mục tiêu**: bác sĩ xem theo tuần, đối chiếu lịch cũ.
- **Điều kiện bắt đầu**: Bước 1–2 xong (API trả đủ + nhận from/to tuần).
- **Điều kiện hoàn thành**: chuyển tuần gọi API đúng khoảng; tuần quá khứ hiện chỉ-đọc (ẩn nút hành động).
- **Rủi ro**: **múi giờ** (xem report C.5) — phải xác nhận trước khi tin số ngày; Chủ nhật; vắt tháng/năm.
- **Test**: tuần hiện tại/trước/sau; thứ 7; Chủ nhật (bỏ); ngày quá khứ (không có nút nghỉ/hủy).
- **Rollback**: revert component.

## Bước 5 — Frontend: chi tiết ca + hiển thị y tá thật

- **Phạm vi**: modal/chi tiết ca dùng API Bước 3; thay hardcode "Chưa phân công y tá" bằng `nurse`
  thật (fallback text khi null); liên kết sang chi tiết lịch hẹn nếu có.
- **File dự kiến sửa**: `DoctorSchedule.tsx` (+ có thể tách component `ShiftDetail`),
  `types/index.ts`.
- **File chỉ đọc**: `components/common/*`.
- **KHÔNG đụng**: backend (đã xong), model, admin.
- **Mục tiêu**: bỏ hardcode y tá; xem được danh sách BN của ca.
- **Điều kiện hoàn thành**: slot có y tá → hiện tên; không có → "Chưa phân công y tá".
- **Rủi ro**: quan hệ thiếu (nurse_id null, phong null) → không crash, hiển thị fallback.
- **Test**: ca của Khang → "Điều dưỡng Thanh Hà"; ca bác sĩ chưa gắn → fallback.
- **Rollback**: revert component.

## Bước 6 — Hoàn thiện yêu cầu nghỉ (đồng bộ + ghi chú + chống trùng)

- **Phạm vi**: API trả thêm `ghi_chu`/`den_ngay` (GAP-2); kiểm tra **trùng đơn nghỉ** cùng ngày ở
  `createLeaveRequest`; FE đối chiếu đơn nghỉ ↔ slot để nút "Gửi yêu cầu nghỉ" bền vững sau reload
  (GAP-5, không thêm field). (Tùy chọn) hiển thị "số lịch hẹn ảnh hưởng" tính động.
- **File dự kiến sửa**: `backend/src/controllers/doctor/leaves.controller.js`,
  `frontend/src/pages/doctor/DoctorSchedule.tsx`, `DoctorLeaveRequests.tsx`,
  `services/doctor-leave.service.ts`, `types/index.ts`.
- **File chỉ đọc**: `models/NghiPhepBacSi.js`, `models/LichHen.js`.
- **KHÔNG đụng**: model schema (giữ nguyên; chỉ đọc field `ghi_chu` đã có), admin duyệt nghỉ.
- **Mục tiêu**: bác sĩ thấy ghi chú Admin, không gửi trùng, biết ảnh hưởng.
- **Điều kiện hoàn thành**: gửi trùng cùng ngày → 409; `ghi_chu` hiện ở FE khi Admin đã xử lý.
- **Rủi ro**: định nghĩa "trùng" (cả ngày vs khung giờ) — cần chốt.
- **Test**: xem `docs/doctor-schedule-analysis-report.md` mục XIX + phần Test bên dưới.
- **Rollback**: revert controller + component.

## Bước 7 — Loại bỏ mock (CHỈ sau khi API thật chạy)

- **Phạm vi**: xóa `frontend/src/mock/doctor-schedule.ts` sau khi **grep xác nhận không còn import**;
  bỏ field type thừa (`DoctorSlot.lock_expires_at`) nếu API vẫn không trả.
- **File dự kiến sửa/xóa**: `mock/doctor-schedule.ts`, `types/index.ts`.
- **KHÔNG đụng**: `mock/*` khác đang dùng cho trang admin/client; `doctor.service.ts` mock (ngoài phạm vi).
- **Điều kiện bắt đầu**: Bước 1–6 xong và ổn định; **gần ngày demo thì KHÔNG xóa mock** (theo memory
  `project_demo_mock_data`).
- **Điều kiện hoàn thành**: build pass, không còn tham chiếu mock lịch bác sĩ.
- **Rủi ro**: xóa nhầm mock đang dùng nơi khác → grep kỹ trước.
- **Rollback**: git revert file mock.

## Bước 8 — Kiểm tra phân quyền (bắt buộc)

- **Test bắt buộc** (mô tả, không phá hoại):
  - Bác sĩ A đổi `scheduleId/slotId` sang ca của bác sĩ B → **404/403**.
  - Bác sĩ A gọi chi tiết ca / rút đơn nghỉ của bác sĩ B → **404/403**.
  - Không token → **401**; token role `user`/`admin` gọi `/api/doctor/*` → **403**.
  - Không có endpoint nào cho bác sĩ đổi phòng/y tá/giờ/sức chứa/duyệt nghỉ/hủy lịch hẹn.
- **File chỉ đọc**: `middlewares/auth.middleware.js`, các route/controller doctor.
- **KHÔNG đụng**: middleware (trừ khi phát hiện lỗ hổng ở prompt sau).

## Bước 9 — Kiểm thử tích hợp

- **Luồng**: đăng nhập bác sĩ → xem tuần → mở chi tiết ca (BN online + offline) → gửi yêu cầu nghỉ
  ca `active` → gửi yêu cầu hủy ca `booked` → sang trang Xin nghỉ thấy đơn `cho_duyet` → hủy đơn.
- **Dữ liệu**: dùng bác sĩ Khang TEST (đã có 8 lịch + 10 lịch hẹn + y tá) — **không seed thêm**.

## Bước 10 — Kiểm tra hồi quy

- **Module có nguy cơ ảnh hưởng**: Dashboard bác sĩ (`stats/today` cũng đọc `LichLamViec`/`LichHen`),
  Danh sách/chi tiết lịch hẹn bác sĩ, trang **admin** ManageDoctorSchedules (chia sẻ model), luồng
  đặt lịch bệnh nhân (dùng chung `slots[].status`), trang y tá (dùng `nurse_id`).
- **Việc cần làm**: chạy test hiện có (`frontend/src/__tests__/*`), kiểm tra thủ công các màn trên
  không đổi hành vi sau khi mở rộng response API.

---

## Thứ tự các prompt tiếp theo (đề xuất)

1. **Prompt 2** — Bước 1–3 (backend: mở rộng response, đếm lịch hẹn, chi tiết ca). Không đụng model.
2. **Prompt 3** — Bước 4–5 (frontend: lịch tuần + chi tiết ca + bỏ hardcode y tá).
3. **Prompt 4** — Bước 6 (hoàn thiện yêu cầu nghỉ) + Bước 8 (phân quyền).
4. **Prompt 5** — Bước 7 (dọn mock, tránh giai đoạn demo) + Bước 9–10 (tích hợp + hồi quy).
5. **Chỉ khi có quyết định nghiệp vụ**: field mới (`loai_nghi`, `so_lich_hen_anh_huong`) — mỗi field
   một prompt riêng, additive, có backup trước.

## Test case bắt buộc (tóm tắt — chi tiết ở report mục XIX)

- **Dữ liệu**: không có lịch; 1 ca; nhiều ca/ngày; ca thiếu phòng; ca thiếu y tá; tham chiếu thiếu;
  trạng thái lạ; lịch hẹn hủy/lỗi thanh toán/đã hoàn thành; DB khác model.
- **Phân quyền**: 8 case ở Bước 8.
- **Yêu cầu nghỉ**: ca tương lai/đã qua/đang diễn ra/đã hủy/đã nghỉ; trùng; thiếu lý do; ca có/không BN;
  rút khi `cho_duyet`/`da_duyet`.
- **Thời gian**: hôm nay; tuần này/trước/sau; thứ 7; Chủ nhật; vắt ngày/tháng/năm; **múi giờ**.
- **Vận hành**: đến sớm/trễ/không đến; khám nhanh/chậm; khách offline; nhiều BN cùng khung; ca đầy;
  2 người đặt chỗ cuối — **lưu ý**: đến sớm/trễ/hàng đợi/tiến độ khám thuộc **lịch hẹn + hàng đợi
  (nurse/appointments)**, KHÔNG đưa vào màn Lịch làm việc.

---

## Trạng thái sau Prompt 4 (Final Review — 2026-07-13)

| Bước | Trạng thái | Test / Bằng chứng | Rủi ro còn lại |
|---|---|---|---|
| Prompt 1 — Phân tích | ✅ Hoàn thành | 3 doc gốc + cập nhật Final Review | — |
| Prompt 2 — Backend/API | ✅ Hoàn thành | Backend **25/25** (gồm cross-doctor 404, no-token 401) | — |
| Prompt 3 — Frontend | ✅ Hoàn thành | Vitest **37/37**, build pass, Playwright 0 console error | — |
| Prompt 4 — Review + nghiệm thu | ✅ Hoàn thành | Live API battery 12/12; sửa BUG-P4-01; browser E2E | — |
| GAP-8 — dữ liệu trùng ngày | ⛔ **Bị chặn (cần Admin/DB)** | FE cảnh báo trung thực | Data integrity — chờ duyệt hướng xử lý |
| Sức chứa ca / khách offline nâng cao | 🔜 Phát triển sau | Ghi ở gap-analysis | Không hardcode, không tuyên bố quá tải |

**Kết luận kỹ thuật**: các Prompt 1–4 của chức năng Lịch làm việc bác sĩ đã hoàn thành, test xanh
toàn bộ, build xanh, đã kiểm thử trình duyệt thật và gọi API phân quyền trực tiếp. Việc còn lại
(**GAP-8**) thuộc tầng database, **không** nằm trong phạm vi sửa tự động — cần Admin/backend-owner
quyết định. Xem báo cáo nghiệm thu: `docs/doctor-schedule-final-acceptance-report.md`.
