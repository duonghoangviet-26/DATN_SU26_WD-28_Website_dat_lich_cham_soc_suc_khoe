# Báo cáo: Xóa actor Y tá — port nghiệp vụ vận hành phòng khám sang Bác sĩ (2026-07-25)

## Bối cảnh

Nghiệp vụ phòng khám đổi: không còn vai trò y tá. Chỉ còn Bệnh nhân / Bác sĩ / Admin (Lễ tân giữ nguyên). Bác sĩ tự làm phần "nhập liệu" mà trước đây y tá đảm nhiệm.

## Khảo sát ban đầu (tóm tắt)

Module y tá không chỉ là UI thừa — nắm toàn bộ nghiệp vụ vận hành: check-in bệnh nhân, hàng đợi động (gọi/vào phòng/kết thúc/bỏ lượt/hủy), trạng thái phòng khám, nhập sinh hiệu ban đầu. Trang `DoctorExamQueue.tsx` trước đây chỉ có nút "xác nhận hồ sơ", mọi bước trước đó hiển thị text tĩnh "Y tá đang xử lý" vì bác sĩ chưa có action tương ứng.

Tin tốt: các model nền (`HangDoi`, `TrangThaiPhongKham`, `SinhHieuKham`) đã thiết kế actor-agnostic từ đầu — không cần migrate schema DB, chỉ cần port logic controller + xây UI phía bác sĩ.

Xác nhận qua DB thật: `NguoiDung.countDocuments({role:'nurse'})` = 0 — an toàn bỏ `'nurse'` khỏi enum `NguoiDung.role`.

## Đã triển khai

### Backend
- **Mới**: `controllers/doctor/room-status.controller.js`, `controllers/doctor/queue.controller.js` — port nguyên logic từ module y tá (transaction Mongo, `tinhMucUuTien`, presence-gate, EWMA thời gian khám TB...), đổi phạm vi từ "nurse-scope lookup nhiều bác sĩ" sang "chính bác sĩ đang đăng nhập" (`getDocId(req.user.id)`), đổi `vai_tro`/`nguoi_dieu_khien_vai_tro` ghi audit từ `'nurse'` → `'doctor'`.
- **Mới**: `routes/doctor/queue.routes.js`, `routes/doctor/room-status.routes.js` — mount tại `/api/doctor/queue` (giữ nguyên `GET` cũ = `examQueue`, thêm `POST /checkin`, `PATCH /:id/{call,into-room,finish,skip,cancel}`), `/api/doctor/room-status`, và `GET /api/doctor/queue-entries` (hàng đợi chi tiết kèm thời gian chờ ước tính).
- **Mở rộng**: `controllers/doctor/appointments.controller.js` — `applyResultEdits` + `createResult` nhận thêm `sinh_hieu`, upsert `SinhHieuKham` theo `appointment_id` (online) hoặc `hang_doi_id` (offline).
- **Xóa**: `routes/nurse/`, `controllers/nurse/`, `utils/nurse-scope.js`, `models/NghiPhepYTa.js` (chưa từng wiring vào API), 5 script test/seed riêng cho y tá.
- **Sửa**: `models/index.js` (bỏ export `NghiPhepYTa`), `models/NguoiDung.js` (bỏ `'nurse'` khỏi enum role), `models/LichLamViec.js`/`LichHen.js` (bỏ field `nurse_id` — xác nhận không có API nào set giá trị thật, chỉ seed script cũ), `models/TrangThaiPhongKham.js` (bỏ field `nurse_id`, `y_ta_co_mat` — dead field), `models/KetQuaKham.js` (bỏ field `them_boi_y_ta_id` — chưa từng dùng), `services/notification.service.js` (bỏ `y_ta`/`'nurse'` khỏi target gửi thông báo), `controllers/doctor/schedule.controller.js` + `stats.controller.js` (bỏ trả field `nurse`/`nurse_id`/`y_ta_ho_tro`), `routes/index.js` (bỏ mount `/nurse`), `scripts/seed-all.js` + `seed-doctor-test-data.js` (bỏ user demo role nurse, thay `nguoi_nhap_id`/`nguoi_do_id` bằng id bác sĩ tương ứng).
- **Giữ nguyên có chủ đích**: `models/NhatKyThaoTac.js` enum `vai_tro` vẫn còn `'nurse'` (đọc log lịch sử cũ); `models/DonThuoc.js` enum `nguon` và `models/ThongBaoHeThong.js` enum `doi_tuong` vẫn còn `'y_ta'` (đọc dữ liệu lịch sử — không còn writer nào tạo giá trị này nữa).
- **Test**: xóa 7 file test tích hợp riêng cho `/nurse/*` (969 dòng — `nurse-unit`, `nurse.createdraft-appointment`, `nurse-queue-business-rules`, `nurse-doctor-status-sync`, `nurse-queue-room`, `nurse-db.models`, `nurse.medical-records-offline`); sửa `doctor.schedule.test.js` (bỏ assertion field `nurse`/`nurse_id`), `doctor.exam-queue.test.js` (sửa comment).

### Frontend
- **Mới trong `doctor-appointment.service.ts`**: `checkinQueue`, `callQueuePatient`, `intoRoomQueue`, `finishQueue`, `skipQueue`, `cancelQueue`, `getRoomStatus`, `updateRoomStatus`, `getQueueEntries`.
- **Mới trong `types/index.ts`**: `VitalSigns`, `QueueEntry`, `QueueCheckinPayload/Entry/Result`, `QueueActionResult`, `RoomStatus` (thay thế nhóm `Nurse*` tương ứng, đặt tên generic không tiền tố Nurse).
- **`ExamResultModal.tsx`**: thêm 5 field sinh hiệu (huyết áp/mạch/nhiệt độ/cân nặng/chiều cao), đưa vào `buildPayload()`.
- **`DoctorExamQueue.tsx`**: thay text tĩnh "Y tá đang xử lý" bằng action theo `trang_thai_tong_hop` (Gọi bệnh nhân / Vào phòng + Bỏ lượt / Kết thúc khám / Nhập hồ sơ), thêm form "Check-in vãng lai", thêm widget trạng thái phòng khám (sẵn sàng/tạm nghỉ).
- **Xóa**: `pages/nurse/` (6 file), `layouts/NurseLayout.tsx`, `components/nurse/` (2 file), `routes/nurseMenu.ts`, `services/nurse.service.ts` + test.
- **Sửa**: `routes/AppRoutes.tsx` (bỏ route `/nurse`), `types/index.ts` (bỏ `"nurse"` khỏi `Role`, xóa khối `Nurse*`, bỏ `y_ta_ho_tro`/`nurse_id`/`nurse` khỏi type lịch bác sĩ, bỏ `"y_ta"` khỏi `NotificationTarget(API)`), `pages/auth/Login.tsx` (bỏ redirect + demo account y tá), `pages/admin/ManageNotifications/SendNotificationTab.tsx` (bỏ option "Chỉ Y tá"), `pages/doctor/DoctorDashboard.tsx` + `DoctorSchedule.tsx` (bỏ hiển thị "Y tá hỗ trợ"), `__tests__/services/schedule.service.test.ts` (bỏ fixture nurse/nurse_id).

## Giới hạn đã biết (không thuộc phạm vi lần này)

1. **Chưa có test tự động cho endpoint mới** (`/doctor/queue/*`, `/doctor/room-status`) — 969 dòng test tích hợp của module y tá đã bị xóa cùng route, chưa viết lại tương đương cho phía bác sĩ. Khuyến nghị: viết bộ test riêng khi có thời gian.
2. **Nhập hồ sơ khám cho lượt vãng lai (offline, không có `LichHen`)** vẫn chưa có API tạo hồ sơ ban đầu — đây là giới hạn có từ trước (module y tá cũ cũng chưa từng có, `createDraft` của y tá luôn yêu cầu `appointment_id`). `DoctorExamQueue.tsx` hiện hiện text "Chưa hỗ trợ nhập hồ sơ vãng lai" cho trường hợp này thay vì crash.
3. **Sinh hiệu không đọc lại được để sửa** trong `ExamResultModal` — form chỉ ghi (không có API lấy `SinhHieuKham` theo appointment để prefill), chấp nhận vì đơn giản hóa phạm vi.

## Xác minh đã thực hiện

- `npx tsc --noEmit` frontend: 96 lỗi trước và sau thay đổi (baseline có sẵn, không liên quan) — xác nhận không phát sinh lỗi type mới.
- `node -e "import('./src/app.js')"` backend: load thành công sau toàn bộ thay đổi.
- Test sanity qua server dev đang chạy (nodemon): `GET /api/doctor/queue-entries`, `/api/doctor/room-status`, `/api/nurse/dashboard` (trước khi xóa) đều trả 401 (route tồn tại, đúng middleware) thay vì 404.
- `NguoiDung.countDocuments({role:'nurse'})` = 0 trên DB thật — xác nhận trước khi sửa enum.
- Grep toàn bộ `backend/src` và `frontend/src` cho `nurse|y_ta|y tá` — chỉ còn các enum lịch sử giữ chủ đích (`NhatKyThaoTac.vai_tro`, `DonThuoc.nguon`, `ThongBaoHeThong.doi_tuong`) và 2 dòng comment giải thích bối cảnh migration.

## Kiểm tra & dọn dẹp dữ liệu y tá trong DB thật (2026-07-25, sau khi code đã xóa xong)

Sau khi xóa code, kiểm tra trực tiếp MongoDB Atlas (read-only trước, script tạm không commit) để xác nhận không còn "rác" dữ liệu y tá sót lại ngoài code.

**Kết quả kiểm tra ban đầu:**
| Hạng mục | Trước dọn | Ghi chú |
|---|---|---|
| `nguoi_dung` role='nurse' | 0 | Sạch từ trước |
| `lich_lam_viec.nurse_id`, `lich_hen.nurse_id`, `ket_qua_kham.them_boi_y_ta_id` | 0 | Sạch — đúng như đã xác nhận lúc xóa field khỏi schema |
| Collection `nghi_phep_y_ta` | tồn tại, 0 documents | Model đã xóa khỏi code nhưng collection Mongo không tự mất theo — rỗng hoàn toàn |
| `trang_thai_phong_kham` còn field `nurse_id`/`y_ta_co_mat`/`nguoi_dieu_khien_vai_tro='nurse'` | 3 documents | Dữ liệu quá khứ (15–17/7/2026, không phải "hôm nay"), field đã bỏ khỏi schema nên code không đọc nữa nhưng dữ liệu thô vẫn còn |
| `thong_bao_he_thong` doi_tuong='y_ta' | 3 documents | Rõ ràng là rác test/debug lúc phát triển (tiêu đề `[AUDIT_y_ta_...]`, `[MailTest] Nurse...`, `[HTTP Email Test]...một y tá cụ thể`) |
| `nhat_ky_thao_tac.vai_tro='nurse'` | 195 documents | **Audit log lịch sử thật — KHÔNG đụng, giữ nguyên theo đúng chủ đích ban đầu** |

**Đã dọn (theo lựa chọn của user — dọn sạch cả 3 nhóm, giữ nguyên audit log):**
1. Drop collection rỗng `nghi_phep_y_ta`.
2. `$unset nurse_id, y_ta_co_mat` trên 3 document `trang_thai_phong_kham`; đồng thời sửa `nguoi_dieu_khien_vai_tro: 'nurse' → 'doctor'` (3 document — phản ánh đúng thực tế vận hành hiện tại, các document này đều thuộc ngày quá khứ nên không ảnh hưởng luồng đang chạy).
3. Xóa 3 document rác test/debug trong `thong_bao_he_thong`.

**Xác nhận sau khi dọn:** tất cả 4 chỉ số trên đều về 0/false; `nhat_ky_thao_tac.vai_tro='nurse'` vẫn còn nguyên 195 documents (không đụng).

Script kiểm tra/dọn dẹp là file tạm (`backend/src/scripts/_tmp-*.js`), chạy 1 lần trực tiếp trên DB rồi xóa ngay sau đó — không commit vào repo.

## Rà soát lại lần 2 (2026-07-25, sau khi đã commit + push lên `Bac_si`)

Rà soát toàn diện lại để đảm bảo không còn sót gì và không phát sinh lỗi mới.

**Grep lại toàn bộ `backend/src` + `frontend/src`:**
- `nurse|Nurse|NURSE`: backend chỉ còn 1 chỗ (`NhatKyThaoTac.vai_tro` enum — giữ chủ đích); frontend 0 kết quả.
- `y_ta|y tá`: backend chỉ còn 2 enum lịch sử (`DonThuoc.nguon`, `ThongBaoHeThong.doi_tuong`) + 1 dòng comment giải thích bối cảnh; frontend 0 kết quả thật (chỉ trùng chuỗi con `ngay_tao`/`ngay_tai_kham`, không liên quan).
- `điều dưỡng`/`dieu duong`: có 3 kết quả nhưng đều KHÔNG liên quan actor y tá — 2 chỗ là mô tả bằng cấp/dịch vụ lấy mẫu tại nhà (`mock/doctors.ts`, `seed-all.js`, tính năng "home_staff" khác hoàn toàn), 1 chỗ là seed notification text cũ.

**Phát hiện thêm 1 field còn sót chưa liệt kê trong lần audit trước:** `KetQuaKham.ghi_chu_dieu_duong` (+ type tương ứng trong `frontend/types/index.ts`). Trước đây y tá tự nhập field này qua `NurseAppointmentDetail.tsx` (đã xóa). Kiểm tra kỹ:
- Không còn controller/route/UI nào đọc hoặc ghi field này nữa (đúng — vì không còn ai đóng vai trò nhập) — **không phải lỗi, không phải regression**, mà là hệ quả đúng của việc bỏ actor y tá.
- DB thật có **24 bản ghi `ket_qua_kham` cũ** chứa dữ liệu lâm sàng thật ở field này (vd: "Bệnh nhân tỉnh, hợp tác tốt") kèm `lich_su_sua` có dòng "Y tá nhập hồ sơ khám" — đây là **dữ liệu hồ sơ khám bệnh thật của bệnh nhân**, không phải rác test.
- Quyết định: **giữ nguyên** field + dữ liệu (cùng chính sách với `nhat_ky_thao_tac` — không viết lại lịch sử hồ sơ y tế), không xóa. Field vẫn được trả về nguyên vẹn qua `GET /api/doctor/appointments/:id/result` (query `.lean()` không giới hạn field) nên không mất dữ liệu khi bác sĩ xem lại hồ sơ cũ, chỉ là hiện tại chưa có UI hiển thị riêng cho trường này (không nằm trong phạm vi yêu cầu ban đầu).

**Xác minh không phát sinh lỗi:**
- `npx tsc --noEmit` (frontend): 96 lỗi — **y hệt baseline trước khi có thay đổi này**, 0 lỗi liên quan `nurse`.
- `npx eslint .` (frontend): 19 lỗi / 27 warning — đối chiếu `git log -S` từng dòng, xác nhận **toàn bộ đã tồn tại từ trước** (các file `Booking.tsx`, `Profile.tsx`, `doctor.service.ts`...), không phát sinh mới từ việc xóa y tá.
- `npx vitest run` (frontend): **50/50 test pass**.
- `node -e "import('./src/app.js')"` (backend): load thành công, không lỗi.
- Kiểm tra route runtime thật (server dev đang chạy): `GET /api/nurse/dashboard` → **404** (route không còn tồn tại); `GET /api/doctor/queue`, `/api/doctor/room-status`, `/api/doctor/queue-entries` → **401** (route tồn tại, đúng middleware, chỉ thiếu token).
- `git status` sau toàn bộ quá trình rà soát: sạch, không sót file tạm nào.

**Kết luận:** actor Y tá đã được loại bỏ hoàn toàn khỏi code (backend + frontend) và dữ liệu vận hành trong DB thật, không phát sinh lỗi type/lint/test/runtime mới. Phần dữ liệu lịch sử còn giữ lại (195 audit log + 24 hồ sơ khám cũ có ghi chú điều dưỡng) là chủ đích, đúng theo nguyên tắc không phá dữ liệu y tế/audit đã có.
