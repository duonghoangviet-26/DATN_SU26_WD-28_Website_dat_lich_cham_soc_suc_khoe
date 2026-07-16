# Audit — Hồ sơ khám (phía Bác sĩ)

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ phần hiển thị/xác nhận hồ sơ khám của bác sĩ. Không kiểm tra sâu trang y tá, không sửa module y tá, không sửa database.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Màn hình/component hiển thị hồ sơ khám cho bác sĩ

| Vai trò | File |
|---|---|
| Component hiển thị | `ExamModal` — định nghĩa trong `frontend/src/pages/doctor/DoctorAppointments.tsx` (dòng 55–264), mở từ nút "Kết quả"/"Xem kết quả"/"Nhập kết quả" ở bảng lịch hẹn |
| Service | `frontend/src/services/examination.service.ts` (`getByAppointment`, `save`) |
| Mock data | `frontend/src/mock/examinations.ts` |
| Type | `ExaminationResult`, `PrescriptionDrug` trong `frontend/src/types/index.ts` |
| Backend controller | `backend/src/controllers/doctor/appointments.controller.js`: `getResult`, `createResult`, `updateResult` |
| Model | `backend/src/models/KetQuaKham.js` |

Không có màn/route riêng cho "hồ sơ khám" — nằm gộp trong trang Lịch hẹn, mở bằng modal.

## 2. Trạng thái hồ sơ (DRAFT / WAITING_DOCTOR_CONFIRM / CONFIRMED / NEED_REVISION)

**Không có.** Schema `KetQuaKham.js` không có field `status`/`trang_thai`, không có enum nào chứa 4 giá trị trên. Field duy nhất mang tính "trạng thái" là `co_the_sua: Boolean` (tự chuyển `false` sau 24h bởi cron) — khác hẳn bản chất workflow (nháp → chờ duyệt → đã duyệt/cần sửa). Type `ExaminationResult` ở frontend cũng không có field trạng thái.

Model đã có sẵn field gợi ý cho đúng luồng này (`nguoi_nhap_id`, `bac_si_phu_trach_id`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan`) nhưng không kèm field trạng thái, và các field này cũng không được set ở đâu (xem mục 6).

## 3. Nút xác nhận hồ sơ

**Không có.** `ExamModal` chỉ có 2 nút: "Đóng" và "Lưu kết quả" / "Cập nhật" (dòng 251–258).

## 4. Nút yêu cầu chỉnh sửa

**Không có.** Không có nút nào gửi yêu cầu chỉnh sửa tới y tá.

## 5. Ô ghi chú lý do yêu cầu chỉnh sửa

**Không có.** Modal chỉ có ô nhập cho chính nội dung hồ sơ (chẩn đoán, hướng dẫn điều trị, ghi chú bổ sung, ngày tái khám, đơn thuốc) — ô để bác sĩ tự viết hồ sơ, không phải ô phản hồi hồ sơ của người khác.

## 6. Hồ sơ có gắn appointment_id, doctor_id, nurse_id, patient_id không

`createResult` (backend):
```js
const result = await KetQuaKham.create({
  appointment_id:     a._id,
  chan_doan:          chan_doan.trim(),
  huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
  ghi_chu:            ghi_chu?.trim() || null,
  ngay_tai_kham:      ngay_tai_kham ? new Date(ngay_tai_kham) : null,
})
```
Chỉ `appointment_id` được gán. `bac_si_phu_trach_id` (doctor_id) và `nguoi_nhap_id` (nurse/người nhập) có sẵn trong schema nhưng **không được set** khi tạo hồ sơ — record tạo ra sẽ có 2 field này là `null`, dù người tạo chính là bác sĩ đang đăng nhập (`docId` đã có sẵn trong scope hàm, chỉ không truyền vào `create()`). Model cũng **không có field `patient_id`** trực tiếp — muốn biết bệnh nhân phải join ngược qua `appointment_id → LichHen.user_id/member_id`.

Về scope theo bác sĩ đăng nhập: `getResult`, `createResult`, `updateResult` đều bắt đầu bằng `LichHen.findOne({ _id: req.params.id, doctor_id: docId })` (docId từ JWT) — bác sĩ không thao tác được lên hồ sơ của lịch hẹn không thuộc mình. Nhưng đây là scope **gián tiếp qua `LichHen`**, không phải do chính `KetQuaKham` lưu `doctor_id` — không thể xác nhận hồ sơ chỉ thuộc lịch hẹn của mình bằng cách nhìn vào chính bản ghi hồ sơ (vì `bac_si_phu_trach_id` luôn `null`), phải suy luận gián tiếp qua bảng lịch hẹn.

## 7. Kết luận

Không có bất kỳ mảnh nào của luồng "y tá nhập → bác sĩ xác nhận/yêu cầu chỉnh sửa" tồn tại trong code hiện tại — khớp với các audit trước, lần này xác nhận chi tiết ở cấp field/dòng code:

- Không trạng thái hồ sơ (DRAFT/WAITING_DOCTOR_CONFIRM/CONFIRMED/NEED_REVISION).
- Không nút xác nhận, không nút yêu cầu chỉnh sửa, không ô ghi lý do.
- Hồ sơ chỉ gắn `appointment_id`; `doctor_id`, `nurse_id`, `patient_id` đều không được lưu trực tiếp dù model đã chừa sẵn chỗ.
- Bác sĩ hiện đang tự viết hồ sơ khám chính (field `chan_doan` bác sĩ tự nhập, tự sửa trong 24h) — ngược hoàn toàn với nghiệp vụ "bác sĩ không trực tiếp nhập hồ sơ khám chính, y tá là người nhập".

Đây là gap kiến trúc lớn nhất trong toàn bộ trang bác sĩ đã phát hiện tới nay — cần thiết kế lại cả model lẫn controller (thêm `trang_thai`, set đúng `bac_si_phu_trach_id`/`nguoi_nhap_id`, thêm route confirm/request-revision) trước khi sửa được UI.

## 8. Trạng thái thực hiện

Không sửa code/database nào ở bước này — chỉ kiểm tra và ghi nhận.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc.
- `Audit - Danh sach lich hen bac si (2026-07-08).md` — audit danh sách lịch hẹn.
- `Audit - Chi tiet lich hen bac si (2026-07-08).md` — audit chi tiết lịch hẹn.
