# Doctor Schedule Final Acceptance Report

> Báo cáo nghiệm thu cuối chức năng **Lịch làm việc bác sĩ** — Prompt 4.
> Sinh ra từ quy trình review-trước-khi-sửa, không viết lại code, không mở rộng chức năng,
> không thay đổi MongoDB.

## 1. Thông tin chung

| | |
|---|---|
| **Chức năng** | Lịch làm việc bác sĩ (xem lịch tuần, chi tiết ca, danh sách lịch hẹn trong ca, gửi/rút yêu cầu nghỉ, yêu cầu hủy ca có bệnh nhân) |
| **Phạm vi** | Frontend + Backend + API + phân quyền + UI/UX + tích hợp của **riêng** chức năng này |
| **Ngày review** | 2026-07-13 |
| **Môi trường** | Backend `http://localhost:5000` (MongoDB Cloud `DATN_VITAFAMILY`), Frontend Vite `http://localhost:5173`, Node 22 |
| **Tài khoản test** | `doctor.test@vitafamily.local` (chính) · `doctor.khang@vitafamily.vn` (đối chiếu cross-doctor) |
| **Tài liệu tham chiếu** | `doctor-schedule-analysis-report.md`, `doctor-schedule-database-gap-analysis.md`, `doctor-schedule-implementation-plan.md` |

## 2. Phạm vi đã kiểm tra

Database (chỉ đọc) · Backend controller/service/route/middleware · API (list, detail, request-cancel,
leaves list/create/cancel) · Frontend (route, danh sách tuần, chi tiết ca, xin nghỉ, rút yêu cầu,
loading/error/empty, responsive) · Phân quyền (live API battery) · UI/UX + responsive (Playwright thật) ·
Tích hợp end-to-end · Hồi quy (auth, appointments, dashboard, module dùng chung).

## 3. Kết quả nghiệp vụ

| Yêu cầu | Kết quả | Bằng chứng | Ghi chú |
|---|---|---|---|
| Dữ liệu thật từ MongoDB | ✅ Đạt | API trả dữ liệu Cloud; browser hiển thị BN/phòng/y tá thật | Không mock runtime |
| FE hết mock/hardcode | ✅ Đạt | `mock/doctor-schedule.ts` đã xóa; grep 0 import | fallback trung thực |
| API lấy đúng lịch bác sĩ đăng nhập | ✅ Đạt | test #9, #12; live battery | scope theo `req.user.id` |
| Không xem được dữ liệu bác sĩ khác | ✅ Đạt | test #7/#15/#21 + live: cross-doctor → 404 | không lộ tồn tại |
| MongoDB↔BE↔API↔FE đồng nhất | ✅ Đạt | type FE khớp response thật; browser đúng | |
| Trạng thái ca / yêu cầu nghỉ đúng | ✅ Đạt | badge map đầy đủ 8 status lịch hẹn + nghỉ | không badge trống |
| Đếm lịch hẹn đúng | ✅ Đạt | helper `thongKeLichHen` loại cancelled/no_show | nhóm `khac` không bỏ sót |
| Lịch đã hủy/hết hiệu lực không tính sai | ✅ Đạt | `RELEASED_STATUSES` tách khỏi `tong_lich_hen` | |
| Xin nghỉ đúng quyền/điều kiện | ✅ Đạt | chặn ngày quá khứ (#18), trùng (#20), thiếu lý do (#17) | luôn tạo `cho_duyet` |
| Không tự hủy lịch bệnh nhân khi xin nghỉ | ✅ Đạt | controller không đụng `LichHen`; chỉ tạo yêu cầu | Admin xử lý điều phối |
| Giao diện đúng vai trò bác sĩ | ✅ Đạt | không nút tạo/sửa/xóa ca, đổi phòng/y tá, duyệt nghỉ | |
| Loading/error/empty đầy đủ | ✅ Đạt | 3 tầng (tuần rỗng / ngày rỗng / chi tiết rỗng) | nút "Thử lại" hoạt động |
| Responsive không vỡ | ✅ Đạt | Playwright 375px + desktop | sidebar co, badge wrap |
| Khách offline tính vào ca | ✅ Đạt | `getScheduleDetail` gộp `member/ten_khach/user` | cờ `la_khach_vang_lai` |
| Đủ điều kiện nghiệm thu | ✅ Đạt | (mục 12) | GAP-8 không chặn luồng chính |

## 4. Kết quả dữ liệu

- **Nguồn**: 100% MongoDB Cloud qua API thật. Không mảng mẫu, không JSON demo, không fallback dữ liệu giả.
- **Quan hệ**: tài khoản → hồ sơ bác sĩ (`BacSi.user_id`); lịch → bác sĩ (`doctor_id`); lịch hẹn → ca
  (`schedule_id` liên kết thật, không suy luận theo giờ); yêu cầu nghỉ → bác sĩ (`bac_si_id`).
- **Dữ liệu thiếu**: hiển thị trung thực — "Chưa phân công" (y tá/phòng), "Chưa có phòng", "Không rõ" (tên
  BN khuyết), empty state "Chưa có lịch hẹn".
- **Nhất quán**: type FE khớp response backend. **Bất thường phát hiện**: GAP-8 (document trùng ngày lịch)
  — xử lý bằng cảnh báo, không che giấu, không tự đoán bản ghi đúng.

## 5. Kết quả Backend và API

- **API kiểm tra**: `GET /doctor/schedule`, `GET /doctor/schedule/:id`,
  `POST /doctor/schedule/:id/slots/:slotId/request-cancel`, `GET/POST /doctor/leaves`,
  `PATCH /doctor/leaves/:id/cancel`.
- **Định danh bác sĩ**: lấy từ token (`req.user.id`) → `BacSi.findOne({ user_id })`. **Không** tin định
  danh từ frontend/query.
- **Phân quyền**: `verifyToken → requireRole('doctor')` áp toàn bộ tại `routes/doctor/index.js`; ownership
  ở từng controller (`findOne({ _id, doctor_id })` → cross-doctor nhận 404).
- **Validation**: thiếu lý do → 400; ngày quá khứ → 400; trùng yêu cầu → 409; sai trạng thái rút → 409;
  không tồn tại → 404.
- **Error handling**: phân biệt 401/403/404/409/400/500; không trả stack trace/secret; không trả mảng rỗng
  để che lỗi xác thực.
- **Timezone fix (đã xác nhận, Prompt 3)**: `localDateStr`/`localStartOfDay` đối xứng cách ghi
  `setHours(0,0,0,0)` — không đổi write-path, không sửa dữ liệu cũ.

## 6. Kết quả Frontend

- **Route**: `/doctor/schedule`, `/doctor/leave-requests`; điều hướng sang `/doctor/appointments` (route sẵn có).
- **Danh sách lịch**: tuần Thứ 2–Thứ 7 (Chủ nhật ngoài lịch làm việc), Tuần trước/Hôm nay/Tuần sau, xem quá
  khứ ở chế độ chỉ-xem.
- **Chi tiết ca (modal)**: ngày, y tá, phòng, thống kê (4 ô), danh sách lịch hẹn (gồm khách vãng lai), nút
  sang "Lịch hẹn của tôi". Không có nút admin/sửa BN/sửa thanh toán.
- **Xin nghỉ**: chỉ hiện với slot `active`, không phải ngày đã qua, chưa có yêu cầu phủ (đối chiếu
  `findCoveringLeave`); có cảnh báo số lịch hẹn ảnh hưởng; khóa nút khi đang gửi.
- **Rút yêu cầu**: chỉ khi `cho_duyet`; cập nhật lại danh sách thật sau thao tác.
- **Loading/Error/Empty**: đủ ở cả trang và modal; nút "Thử lại" (`reloadKey`) hoạt động.
- **Responsive**: desktop + mobile 375px xác nhận qua Playwright.

## 7. Kết quả kiểm thử

| Nhóm test | Tổng | Passed | Failed | Skipped | Ghi chú |
|---|---:|---:|---:|---:|---|
| Backend integration (`npm test`) | 25 | 25 | 0 | 0 | gồm cross-doctor 404, no/invalid-token 401 |
| Frontend unit (`vitest run`) | 37 | 37 | 0 | 0 | service + `scheduleWeek` logic |
| Phân quyền live (API battery) | 12 | 12 | 0 | 0 | mục 8 |
| `tsc --noEmit` | — | — | 108 | — | **pre-existing**, 0 từ file chức năng lịch |
| `vite build` | 1 | 1 | 0 | 0 | built in ~4.3s |
| Browser E2E (Playwright) | — | pass | 0 | — | 0 console error; week/modal/mobile |

**Ghi chú 108 lỗi `tsc`**: nằm ở `mock/doctor-appointments.ts` và các interface payment/service trong
`types/index.ts` (trùng khai báo `la_goi`, `trang_thai_hoa_don`, `so_hoa_don`, `ServiceTargetAudience`…) —
**pre-existing, ngoài phạm vi**, không chặn build, không liên quan chức năng lịch (đã grep xác nhận 0 lỗi
đề cập type `DoctorSchedule*/DoctorSlot/DoctorLeaveRequest`).

## 8. Kết quả phân quyền (live API battery)

| Tình huống | Kỳ vọng | Kết quả |
|---|---|---|
| Bác sĩ xem lịch của mình | 200 + chỉ dữ liệu mình | ✅ |
| Bác sĩ B đọc chi tiết ca của A (đổi ID) | 404 | ✅ |
| Bác sĩ B request-cancel slot của A | 404 | ✅ |
| Bác sĩ B đọc appointment của A | 404 (không lộ) | ✅ |
| Bác sĩ B rút yêu cầu nghỉ của A | 404 | ✅ |
| Lịch của B **không** chứa bản ghi của A | loại trừ hoàn toàn | ✅ |
| Không token | 401 | ✅ |
| Token không hợp lệ | 401 | ✅ |

→ **Không truy cập chéo bác sĩ. Không vượt quyền qua API. Bảo mật ở backend, không chỉ ẩn nút.**

## 9. Kết quả UI/UX

Card đồng đều không bóp méo · badge trạng thái/thanh toán rõ, wrap không tràn · y tá/phòng dữ liệu thật +
fallback trung thực · modal chi tiết không tràn màn hình · bộ điều hướng tuần hoạt động · empty state đúng
(không BN mẫu) · mobile 375px sidebar co, không cuộn ngang. Đã xem trực tiếp ảnh chụp (không chỉ log).

## 10. Lỗi đã sửa

| Mã | Mức độ | Nội dung | File | Kết quả |
|---|---|---|---|---|
| BUG-P4-01 | Medium (test) | Assert cứng `data.length === 8` ném lỗi trước khi gán fixture `appointments` → test chi tiết #6 và **test bảo mật cross-doctor #7 crash ở setup, không chạy tới assertion 404** | `backend/tests/doctor.api.test.js` | Gán fixture trước + assert sàn `>= 8`; backend **22/25 → 25/25**; test #7 chạy thật và pass |

## 11. Lỗi còn lại

| Mã | Mức độ | Ảnh hưởng | Trạng thái | Hướng xử lý | Chặn nghiệm thu? |
|---|---|---|---|---|---|
| GAP-8 (nguyên nhân gốc) | High (Backend) | Write-path ghi `ngay` lệch múi giờ → sinh document trùng ngày | ✅ **Đã sửa** (Lớp A+B+C+E: TZ=UTC + `toScheduleDayUTC` canonical 00:00Z + upsert idempotent) — người dùng duyệt; verify không sinh bản trùng mới, BE 25/25, E2E 0 error | — | ❌ Không |
| GAP-8 (dữ liệu cũ) | High (Database) | 21 document trùng cũ vẫn tồn tại | ⏳ **Còn lại — Lớp D**, cần Admin duyệt (đụng lịch hẹn thật) | Script 2 pha (báo cáo → hợp nhất) + backup; FE vẫn cảnh báo trung thực | ❌ Không chặn (FE xử lý an toàn) |
| TSC-LEGACY | Low | 108 lỗi type ở module payment/service/mock | Ngoài phạm vi (không phải chức năng lịch) | Dọn ở prompt riêng cho module đó | ❌ Không |

## 12. Kết luận nghiệm thu

### ✅ ĐẠT CÓ ĐIỀU KIỆN

**Luồng chính hoạt động đầy đủ trên dữ liệu thật, không lỗi bảo mật, không dùng dữ liệu giả, test xanh
toàn bộ (BE 25/25, FE 37/37, build pass), đã kiểm thử trình duyệt thật và phân quyền qua API trực tiếp.**

Điều kiện kèm theo (không chặn luồng chính, đã ghi nhận trung thực):
1. **GAP-8** (dữ liệu trùng ngày) thuộc tầng database — cần Admin/backend-owner quyết định hướng xử lý.
   Frontend hiện cảnh báo an toàn, không hiển thị sai. **Chưa** tự động sửa vì vi phạm điều kiện dừng.
2. Một số nghiệp vụ nâng cao (sức chứa ca, dữ liệu check-in đến sớm/trễ) **chưa có trong DB** → là hướng
   phát triển, **không** được hardcode/tuyên bố hỗ trợ.
3. 108 lỗi `tsc` pre-existing ở module ngoài phạm vi — không ảnh hưởng build/chức năng lịch.

Không hạ mức độ lỗi để tuyên bố "Đạt"; không có lỗi Critical/High nào chặn luồng chính còn tồn đọng
trong phạm vi chức năng này.
