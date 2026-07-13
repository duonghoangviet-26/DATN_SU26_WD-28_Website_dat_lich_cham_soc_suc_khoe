# Kiểm tra — Luồng nghiệp vụ "Hồ sơ xác nhận" hiện tại

> Ngày: 2026-07-11. Yêu cầu: kiểm tra luồng hồ sơ xác nhận đã đúng chưa, các chức năng đã dùng được chưa, nghiệp vụ thế nào. Đây là **báo cáo kiểm tra — chưa sửa gì** ngoài những việc đã làm ở yêu cầu trước (log lịch sử khi xác nhận + mở rộng lọc). Mọi phát hiện dưới đây đọc trực tiếp từ code, không suy đoán.

---

## 1. Luồng nghiệp vụ hiện tại (đã xác nhận chạy được đầy đủ 2 phía)

```
Y tá (NurseAppointmentDetail.tsx)                    Bác sĩ (DoctorAppointments.tsx / DoctorPendingRecords.tsx)
──────────────────────────────────                   ─────────────────────────────────────────────────────────
1. Tạo nháp (createDraft)          → status: ban_nhap
2. Sửa nháp (updateRecord)         → vẫn ban_nhap
3. Gửi bác sĩ (submit)             → status: cho_xac_nhan
                                       LichHen.status → 'waiting_doctor_confirm'
                                                                          4. Thấy hồ sơ trong "Hồ sơ chờ xác nhận"
                                                                             hoặc trong expand-row lịch hẹn
                                                                          5a. Xác nhận (confirmResult)
                                                                              → status: da_xac_nhan
                                                                              → LichHen.status → 'completed'
                                                                              → ghi lich_su_sua ✅ (mới thêm)
                                                                          5b. Yêu cầu chỉnh sửa (requestResultRevision)
                                                                              → status: yeu_cau_chinh_sua
                                                                              → ghi lich_su_sua ✅ (đã có sẵn)
6. (nếu 5b) Sửa lại (updateRecord) → vẫn yeu_cau_chinh_sua
7. Gửi lại (resubmit)              → status: cho_xac_nhan (lặp lại từ bước 4)
```

**Đã xác nhận qua code — không phải suy đoán**:
- Backend: `backend/src/controllers/nurse/medical-records.controller.js` (đủ 6 hàm: `list`, `listRevisions`, `getById`, `createDraft`, `update`, `submit`/`resubmit`) + `backend/src/controllers/doctor/appointments.controller.js` (`confirmResult`, `requestResultRevision`, `getResult`, `createResult`, `updateResult`).
- Frontend y tá: `frontend/src/pages/nurse/NurseAppointmentDetail.tsx` gọi đủ `createDraft`/`updateRecord`/`submit`/`resubmit` (đã grep xác nhận cả 4 lời gọi tồn tại), nút đổi nhãn đúng theo trạng thái ("Gửi bác sĩ xác nhận" / "Gửi lại bác sĩ").
- Frontend bác sĩ: `DoctorAppointments.tsx` (expand-row có đủ Xem hồ sơ/Xác nhận hồ sơ/Yêu cầu chỉnh sửa khi `ket_qua_status === 'cho_xac_nhan'`), `DoctorPendingRecords.tsx` (danh sách + modal xem, nay có thêm lọc + lịch sử).
- Phân quyền: mọi hàm y tá lọc theo `nguoi_nhap_id: req.user.id`/`nurse_id`; mọi hàm bác sĩ lọc theo `doctor_id`/`bac_si_phu_trach_id` từ JWT — không tin ID từ client ở cả 2 phía.

**Kết luận phần 1**: khung nghiệp vụ chính **đã đúng và dùng được** — không phải tính năng nửa vời hay chỉ có backend không có UI.

---

## 2. Vấn đề phát hiện — mức độ cao (ảnh hưởng tính toàn vẹn dữ liệu)

### H1. Hồ sơ đã xác nhận (`da_xac_nhan`) vẫn sửa được nội dung vô thời hạn

- Nút "Xem hồ sơ" trong `DoctorAppointments.tsx` (dòng gọi `setExamAppt(appt)`) mở `ExamModal` — **đây là form sửa được, không phải màn chỉ xem**, dù tên nút là "Xem hồ sơ".
- `ExamModal.isReadOnly` chỉ dựa vào `existing.co_the_sua` (cờ 24 giờ), **không xét `ket_qua_status`** — nghĩa là hồ sơ đã `da_xac_nhan` vẫn hiện form sửa được bình thường.
- `updateResult()` (backend, PUT) cũng **không kiểm tra `result.status`** trước khi cho sửa — chỉ chặn khi `!co_the_sua`.
- **Đã kiểm tra toàn bộ `backend/src/cron/index.js`: chỉ có 2 cron job (sinh lịch T+7, auto-cancel home quá hạn thanh toán) — không có job nào từng đặt `co_the_sua = false`.** Đã `grep` toàn bộ backend cho `co_the_sua` — trường này chỉ được **đọc** (so sánh `if (!result.co_the_sua)`) và **khởi tạo mặc định `true`** trong schema, **không có chỗ nào gán lại thành `false`** trong toàn bộ mã nguồn hiện có.

**Hệ quả thực tế**: dòng chữ "Kết quả đã được lưu trên 24 giờ — không thể chỉnh sửa" trong `ExamModal` sẽ **không bao giờ hiển thị**, vì điều kiện kích hoạt nó (`co_the_sua = false`) không bao giờ xảy ra. Hồ sơ khám — kể cả đã được bác sĩ xác nhận — có thể bị sửa nội dung (chẩn đoán, đơn thuốc...) **vĩnh viễn**, không quay lại trạng thái "chờ xác nhận" và không lưu vết.

### H2. Sửa nội dung hồ sơ không được ghi vào "lịch sử thay đổi"

Tính năng "lịch sử thay đổi" vừa xây (yêu cầu trước) chỉ ghi vào `lich_su_sua` ở **đúng 2 chỗ**: `confirmResult()` (mới thêm) và `requestResultRevision()` (đã có sẵn trước đó). Các hành động khác **hoàn toàn không ghi**:

| Hành động | Ghi lịch sử? |
|---|---|
| Y tá tạo nháp (`createDraft`) | ❌ Không |
| Y tá sửa nháp (`update`) | ❌ Không |
| Y tá gửi/gửi lại (`submit`/`resubmit`) | ❌ Không |
| Bác sĩ sửa nội dung (`updateResult`) | ❌ Không |
| Bác sĩ xác nhận (`confirmResult`) | ✅ Có (mới thêm) |
| Bác sĩ yêu cầu chỉnh sửa (`requestResultRevision`) | ✅ Có (đã sẵn) |

**Hệ quả**: nếu mục tiêu "đối chiếu sau này" là biết được toàn bộ diễn biến một hồ sơ (ai viết, viết gì, ai sửa, sửa gì), tính năng hiện tại **chưa đủ** — chỉ trả lời được "khi nào xác nhận / khi nào yêu cầu chỉnh sửa", không trả lời được "nội dung đã bị đổi bao nhiêu lần, đổi những gì, ai đổi".

---

## 3. Vấn đề phát hiện — mức độ trung bình (lệch dữ liệu hiển thị, không phải sai nghiệp vụ)

### M1. `waiting_doctor_confirm` thiếu trong type `AppointmentStatus` (frontend)

Backend `submitForDoctorConfirm()` (nurse controller) set `LichHen.status = 'waiting_doctor_confirm'` khi y tá gửi hồ sơ. Nhưng `frontend/src/types/index.ts`:
```ts
export type AppointmentStatus = "pending" | "confirmed" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show"
```
**không có** `"waiting_doctor_confirm"` — dù `APPOINTMENT_STATUS_LABEL`/`APPOINTMENT_STATUS_COLOR` (constants.ts) đã có label/màu cho nó từ trước. TypeScript không bắt được lỗi này vì các `Record` đó khai kiểu `Record<string, ...>` chứ không phải `Record<AppointmentStatus, ...>` — không gây crash nhưng phản ánh type chưa khớp thực tế backend trả về.

### M2. `DoctorDashboard.tsx` chưa dùng bảng màu trạng thái tập trung

`DoctorDashboard.tsx` (dòng 14) vẫn giữ `STATUS_COLOR` cục bộ riêng — **không phải** `APPOINTMENT_STATUS_COLOR` tập trung đã tạo ở bước chuẩn hoá trước. Vì `STATUS_COLOR` cục bộ này thiếu key `waiting_doctor_confirm`, nếu 1 lịch hẹn ở trạng thái đó lọt vào danh sách "Lịch hẹn gần nhất" trên Dashboard, badge sẽ hiển thị **màu xám mặc định thay vì vàng** — đúng loại rủi ro "lệch màu giữa các trang" đã cảnh báo ở audit thiết kế đầu tiên (mục 2.6), nay xác nhận có cơ sở xảy ra thật (không phải giả định).

### M3. Tên nút gây hiểu lầm

Nút "Xem hồ sơ" (cả ở `DoctorAppointments.tsx` và ngữ cảnh liên quan) thực chất mở form **sửa được** — nên đặt tên phản ánh đúng bản chất (vd tách "Xem" chỉ đọc và "Sửa" khi cần, hoặc đổi nhãn) để tránh bác sĩ vô tình sửa nội dung mà tưởng chỉ đang xem.

---

## 4. Câu hỏi nghiệp vụ cần bạn xác nhận (không phải bug)

**L1 — Bác sĩ tự viết hồ sơ rồi tự xác nhận**: khi bác sĩ tự nhập kết quả khám qua `ExamModal` (không qua y tá), hồ sơ vào thẳng `cho_xac_nhan` (bỏ qua `ban_nhap`) — nghĩa là hồ sơ đó xuất hiện trong "Hồ sơ chờ xác nhận" và chính bác sĩ đó phải tự bấm "Xác nhận" cho hồ sơ do chính mình viết. Không sai kỹ thuật (đã có comment trong code xác nhận đây là hành vi cũ giữ nguyên có chủ đích), nhưng là một vòng lặp hình thức — xác nhận với bạn đây có phải hành vi mong muốn, hay chỉ nên yêu cầu xác nhận khi hồ sơ đến từ y tá (người khác nhập)?

---

## 5. Đề xuất xử lý (chưa làm, chờ bạn chọn)

| # | Vấn đề | Đề xuất | Mức ảnh hưởng nếu sửa |
|---|---|---|---|
| H1 | Hồ sơ đã xác nhận vẫn sửa được vô hạn | (a) `updateResult()` chặn sửa khi `status === 'da_xac_nhan'` (bác sĩ muốn sửa hồ sơ đã xác nhận phải có luồng riêng, vd "yêu cầu mở lại"), hoặc (b) triển khai cron khóa `co_the_sua=false` sau 24h như comment đã mô tả từ đầu | Trung bình — đụng luồng đang chạy, cần bạn quyết định hướng (a) hay (b) hay cả hai |
| H2 | Sửa nội dung không lưu lịch sử | Thêm 1 dòng `lich_su_sua.push(...)` vào `updateResult()` (bác sĩ sửa) và các hàm y tá (`update`, `submit`, `resubmit`) — mỗi nơi 1 dòng, rủi ro thấp vì field đã tồn tại sẵn | Thấp — thuần bổ sung, không đổi hành vi cũ |
| M1 | Thiếu `waiting_doctor_confirm` trong type | Thêm vào union `AppointmentStatus` | Thấp |
| M2 | Dashboard lệch màu | Xoá `STATUS_COLOR` cục bộ trong `DoctorDashboard.tsx`, dùng `APPOINTMENT_STATUS_COLOR` tập trung (đúng việc đã định làm ở bước 5 kế hoạch UI/UX trước nhưng bị bỏ sót) | Thấp |
| M3 | Tên nút gây hiểu lầm | Đổi nhãn hoặc tách nút Xem/Sửa | Thấp — thuần UI |
| L1 | Bác sĩ tự xác nhận hồ sơ tự viết | Chờ bạn xác nhận có cần đổi luồng không | — |

---

## 6. Trạng thái thực hiện

Chỉ kiểm tra và ghi nhận — chưa sửa gì lúc viết báo cáo. Sau đó bạn đã xác nhận mục L1: **hồ sơ do bác sĩ tự nhập không cần qua bước "chờ xác nhận" nữa**. Đã thực hiện — xem mục 7.

---

## 7. Nhật ký thực hiện — L1: Bỏ bước tự xác nhận cho hồ sơ bác sĩ tự nhập

### File đã sửa
- `backend/src/controllers/doctor/appointments.controller.js` (`createResult()`)
- `backend/src/models/KetQuaKham.js` (cập nhật lại comment mô tả luồng — không đổi schema)
- `frontend/src/types/index.ts` (thêm `status?: KetQuaKhamStatus` vào `ExaminationResult`)
- `frontend/src/pages/doctor/DoctorAppointments.tsx` (`onSaved` của `ExamModal`)

### Nội dung
- `createResult()`: khi bác sĩ tự nhập hồ sơ (không qua y tá), tạo thẳng với `status: 'da_xac_nhan'`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan` = chính bác sĩ đó/thời điểm tạo, và ghi 1 dòng vào `lich_su_sua`: "Bác sĩ tự nhập và xác nhận hồ sơ khám". Không đổi `createDraft()` của y tá (vẫn `ban_nhap` như cũ) — chỉ đổi nhánh bác sĩ tự nhập.
- Vì `DoctorAppointments.tsx` chỉ hiện nút "Xác nhận hồ sơ"/"Yêu cầu chỉnh sửa" khi `ket_qua_status === 'cho_xac_nhan'`, hồ sơ tự nhập giờ có `ket_qua_status = 'da_xac_nhan'` ngay từ đầu nên 2 nút đó **tự động không hiện** — không cần sửa thêm JSX điều kiện nào.
- Tiện sửa luôn 1 lỗi liên quan phát hiện khi kiểm tra: `onSaved` của `ExamModal` trước đây **bỏ qua tham số `result`**, chỉ set `da_co_ket_qua: true` cục bộ mà không cập nhật `ket_qua_status` — khiến badge trạng thái hồ sơ không hiện ngay sau khi lưu (phải tải lại trang mới thấy đúng). Đã sửa để đọc `result.status` (nay backend luôn trả kèm) và cập nhật state tại chỗ.
- Cập nhật lại comment trong `KetQuaKham.js` mô tả đúng luồng mới, tránh gây hiểu nhầm cho người đọc code sau này (comment cũ nói ngược lại: "giữ nguyên default cho_xac_nhan").

### Không đổi
- Luồng y tá (`createDraft`, `update`, `submit`, `resubmit`) — không đụng.
- `confirmResult`, `requestResultRevision`, `updateResult` — không đổi logic, vẫn dùng cho hồ sơ y tá gửi.
- Không đổi route, không đổi tên trạng thái, không đổi quyền hạn.

### Kiểm tra
- `node --check` cho 2 file backend: hợp lệ.
- `npx tsc --noEmit`: không lỗi mới, chỉ còn 32 lỗi pre-existing ở `mock/doctor-appointments.ts` (không liên quan).
- Chưa chạy được với DB thật trong môi trường này — cần bạn tự xác nhận: bác sĩ tự nhập kết quả khám qua nút "Nhập kết quả"/"Kết quả" → badge hiện ngay "Đã xác nhận", không còn xuất hiện trong trang "Hồ sơ chờ xác nhận".

### Rủi ro còn lại
- H1 (hồ sơ đã xác nhận vẫn sửa được vô hạn), H2 (sửa nội dung không ghi lịch sử ở `updateResult`/luồng y tá), M1-M3 (mục 3) — **chưa xử lý**, vẫn chờ bạn xác nhận hướng làm theo bảng mục 5.
