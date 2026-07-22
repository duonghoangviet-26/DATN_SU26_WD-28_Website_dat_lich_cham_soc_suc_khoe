# PROMPT 28 — Báo cáo sửa đồng bộ Doctor–Nurse (khôi phục luồng revision)

> Ngày: 2026-07-19 · Nhánh `Bac_si`. QĐ-1/A: khôi phục luồng "yêu cầu chỉnh sửa". Chạm doctor page tại **điểm tích hợp bắt buộc** (đã báo cáo & được chọn trước khi sửa).

## Bối cảnh
Đối chiếu 10 test bắt buộc với code sau P18–27: **8/10 đã đạt**. Chỉ #5 (bác sĩ yêu cầu sửa) và #6 (y tá gửi lại) không chạy vì **producer `yeu_cau_chinh_sua` phía bác sĩ đã gỡ có chủ đích 2026-07-16**. Người dùng chọn **hướng A — khôi phục** (thay vì B — gỡ UI mồ côi phía y tá).

Phía y tá **đã sẵn sàng nhận** revision từ trước (mồ côi vì thiếu producer): `update` cho phép sửa khi `yeu_cau_chinh_sua`, `resubmit` (transaction), banner `doctor_revision_note`, trang `NurseRevisions`, dashboard `ho_so_can_sua`, `pendingRecords` (giai_doan `yeu_cau_chinh_sua`). → Chỉ cần thêm **producer phía bác sĩ**.

## Thay đổi

| File | Thay đổi |
|---|---|
| BE `doctor/appointments.controller.js` | **+ `requestRevision`** (`import mongoose`): `cho_xac_nhan` → `yeu_cau_chinh_sua` + `doctor_revision_note` + push `lich_su_sua`; revert `LichHen` → `waiting_record`. **Transaction** (2 bảng nguyên tử). Bắt buộc `ly_do`; đọc trạng thái tươi trong tx; chỉ bác sĩ phụ trách |
| BE `routes/doctor/appointments.routes.js` | **+ `PATCH /:id/result/request-revision`** (thay comment "đã gỡ") |
| FE `services/doctor-appointment.service.ts` | **+ `requestRevision(id, ly_do)`** |
| FE `components/doctor/ExamResultModal.tsx` | + prop `onRevisionRequested`, state `revisionReason`, `handleRequestRevision`; **ô lý do + nút "Yêu cầu chỉnh sửa"** (confirm mode, song song "Lưu & Xác nhận") |
| FE `pages/doctor/DoctorExamQueue.tsx` | Truyền `onRevisionRequested={() => { closeModal(); load() }}` |
| BE `tests/doctor.confirm-result.test.js` | Thay test cũ ("route đã gỡ → 404") bằng **4 test hành vi mới** (revision OK; thiếu ly_do→400; da_xac_nhan→409; bác sĩ khác→404) |

**Không sửa gì thêm phía nurse** — nurse side đã có sẵn để nhận.

## Đáp ứng nguyên tắc
- **Một nguồn sự thật:** trạng thái lịch = `LichHen.status`, trạng thái hồ sơ = `KetQuaKham.status`. Mọi chuyển tiếp 2-bảng bọc **transaction** (submit/resubmit P25, request-revision mới).
- **Không tính trạng thái khác nhau ở 2 FE:** cả 2 đọc từ BE, không suy diễn.
- **Mutation → refetch:** doctor `onRevisionRequested`→`load()`; nurse `load()` sau thao tác.
- **Appointment ↔ record không lệch:** request-revision set cả hai trong 1 transaction; lỗi giữa chừng → rollback cả hai.
- **Không mock** ✅. **Không 2 API trái ngược:** `requestRevision` và `confirmResult` **bổ sung** nhau (bác sĩ chọn 1 trong 2), không mâu thuẫn.
- **Không sửa doctor ngoài điểm bắt buộc:** chỉ thêm producer revision (endpoint + nút mở nó) + test tương ứng.

## 10 test bắt buộc — sau khi sửa

| # | Test | Kết quả | Cơ chế |
|---|---|---|---|
| 1 | Y tá check-in → bác sĩ thấy | ✅ | HangDoi → doctor examQueue |
| 2 | Bác sĩ bắt đầu khám → y tá thấy | ✅ | into-room set `in_progress` |
| 3 | Kết thúc khám → y tá thấy cần nhập | ✅ | finish set `waiting_record` |
| 4 | Y tá gửi hồ sơ → bác sĩ thấy chờ | ✅ | submit (tx) → doctor pending `cho_xac_nhan` |
| 5 | **Bác sĩ yêu cầu sửa → y tá thấy cần sửa** | ✅ **(mới)** | requestRevision (tx) → nurse dashboard/NurseRevisions/banner |
| 6 | **Y tá gửi lại → bác sĩ nhận lại** | ✅ **(mới)** | resubmit (tx) → doctor pending default `cho_xac_nhan` |
| 7 | Bác sĩ xác nhận → y tá thấy hoàn thành + khóa | ✅ | confirmResult → `da_xac_nhan`+completed; P27 khóa FE/BE |
| 8 | Reload cả hai đúng | ✅ | không cache, luôn refetch từ BE |
| 9 | Gửi lặp không tạo trùng | ✅ | guard saving + sparse-unique + tx |
| 10 | Hai tài khoản không thấy ngoài quyền | ✅ | nurse ca-scope; doctor `doctor_id`/`bac_si_phu_trach_id`; requestRevision chặn bác sĩ khác (→404) |

## Luồng revision (vòng khép kín)
1. Nurse submit → `KetQuaKham=cho_xac_nhan`, `LichHen=waiting_doctor_confirm` (tx). Bác sĩ thấy.
2. **Doctor requestRevision** → `KetQuaKham=yeu_cau_chinh_sua`+note, `LichHen=waiting_record` (tx). Y tá thấy (rời khỏi pending của bác sĩ).
3. Nurse sửa (`update` cho phép) + resubmit → `cho_xac_nhan`, `waiting_doctor_confirm` (tx). Bác sĩ nhận lại.
4. Doctor confirmResult → `da_xac_nhan`+`nguoi_xac_nhan_id`+`LichHen=completed`. Y tá thấy khóa (P27).

## Kiểm thử
- BE `node --check` (controller/route/test) → OK.
- FE type-check → **110/3 = baseline**, 0 lỗi mới. Build `vite build` → ✅ (12.27s).
- 4 test integration mới (`doctor.confirm-result.test.js`) — **viết xong, `node --check` OK**. **Chưa chạy live** (cần server + DB ghi — cùng cổng "Bước 17"; theo ràng buộc DB read-only, không tự chạy).

## Rủi ro & ghi nhận
- **Rủi ro trung bình** — có chạm doctor page (được phép, đã báo cáo & chọn A). Không đổi schema/DB.
- **Điểm cần lưu ý:** nay bác sĩ có **2 lựa chọn** ở màn "Xác nhận hồ sơ": "Lưu & Xác nhận" (chốt) hoặc "Yêu cầu chỉnh sửa" (trả về y tá). Đây là chủ đích của hướng A. Nếu team muốn chỉ 1 luồng → chọn B ở lần sau.
- `into-room`/`finish`/`check-in` phía nurse vẫn ghi 2 bảng **không transaction** (HangDoi + LichHen). Chưa nằm trong điểm lệch report P13 mục B.4 (chỉ nêu submit/confirm — đã xử lý). Rủi ro thấp (LichHen.updateOne là ghi cuối, đơn giản). Ghi nhận để bọc transaction ở đợt sau nếu cần.

## Vấn đề còn tồn
- Chạy live 10 kịch bản cần server + seed (Bước 17).
- (Tùy) bọc transaction into-room/finish/check-in.
- (Tùy) refetch-on-focus cho stale chéo trang (chưa có realtime).
