# Audit — Type/Interface trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ type liên quan doctor page. Không sửa type dùng chung admin/patient nếu chưa chắc chắn, không đổi cấu trúc toàn bộ model.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Type/interface tìm được cho 6 nhóm yêu cầu

| Nhóm | Type hiện có | Vị trí |
|---|---|---|
| DoctorDashboard | ❌ Không có type riêng. `DoctorDashboard.tsx` tự ghép từ `DoctorStats` + `DoctorReview[]`, không có 1 type tổng "DoctorDashboard" nào bao trọn dữ liệu trang | `types/index.ts` (rải rác) |
| DoctorSchedule | `DoctorSlot` (có alias `Schedule = DoctorSlot`) | `types/index.ts` dòng 347–370 |
| DoctorAppointment | ❌ Không có type "DoctorAppointment" trần — chỉ có `DoctorAppointmentDetail`, dùng chung cho cả list lẫn detail (không tách summary/detail) | `types/index.ts` dòng 372–396 |
| DoctorAppointmentDetail | ✅ Có, như trên | cùng vị trí |
| MedicalRecord | ❌ Không có type tên "MedicalRecord". Gần nhất là `ExaminationResult` — nhưng không có `status`, không có `nurse_id`/`doctor_id`/`patient_id` — không phản ánh đúng khái niệm "hồ sơ khám" theo nghiệp vụ yêu cầu | `types/index.ts` dòng 409–419 |
| DoctorLeaveRequest | ❌ Không tồn tại — khớp việc tính năng xin nghỉ chưa được xây dựng ở cả 2 tầng FE/BE | — |

## 2. Field có đủ cho UI không

Đã kiểm chi tiết ở các audit trước, tổng hợp lại:

- **`DoctorSlot`**: đủ cho UI hiện tại, nhưng thiếu field y tá hỗ trợ — không có `nurse`/`y_ta` nào trong type.
- **`DoctorAppointmentDetail`**: thiếu `chuyen_khoa` và không có field nào hiển thị "mã lịch hẹn" dạng người đọc được (chỉ có `id: number` dùng nội bộ); thiếu y tá hỗ trợ. Đã liệt kê đầy đủ ở `Audit - Chi tiet lich hen bac si`.
- **`ExaminationResult`**: thiếu toàn bộ field cần cho luồng xác nhận (`status`, `nurse_id`, `doctor_id`, `patient_id`, `ghi_chu_yeu_cau_sua`) — đã phân tích sâu ở `Audit - Ho so kham bac si`.
- **`DoctorStats`/`DoctorReview`**: đủ cho nội dung "thống kê hành nghề" hiện có, nhưng không có field nào phục vụ "tổng quan hôm nay" (ca làm việc, phòng, đếm theo trạng thái trong ngày) — đã ghi ở `Audit - Dashboard bac si`.

## 3. Có dùng `any` quá nhiều không

Trong phạm vi doctor page: không. Grep `: any`, `<any>`, `as any` trên toàn bộ `frontend/src/pages/doctor/*` và 4 service `doctor-profile.service.ts`/`schedule.service.ts`/`examination.service.ts`/`doctor-appointment.service.ts` → 0 kết quả. Type-safety trong phạm vi trang bác sĩ đang tốt.

Ngoài phạm vi (chỉ nêu để lưu ý, không thuộc doctor page): `frontend/src/services/doctor.service.ts` (file admin/client dùng, không được doctor page import) có dùng `any` khá nhiều: `update(id, payload: any)`, `Promise<{ data: any[]; ... }>`, `delete(id): Promise<any>`. Không đề xuất sửa vì nằm ngoài phạm vi trang bác sĩ.

## 4. Type có bị trộn dữ liệu admin không

Có 1 trường hợp đáng chú ý: **`DoctorProfile`**. Type này (dùng bởi `DoctorProfile.tsx` — trang hồ sơ cá nhân của bác sĩ) cũng được admin dùng ở `pages/admin/ManageServiceSpecialtyDetail.tsx` (`useState<DoctorProfile[]>`, `useState<DoctorProfile | null>`) để hiển thị danh sách bác sĩ khi gán bác sĩ vào chuyên khoa/dịch vụ. Type có comment sẵn: *"ViewModel kết hợp thông tin bác sĩ + user (dùng cho trang danh sách)"* — cho thấy đây là thiết kế có chủ đích (1 type entity dùng chung cho nhiều màn hiển thị danh sách bác sĩ), không phải lỗi vô tình. Tuy nhiên, xét từ góc độ "trang bác sĩ", `DoctorProfile` không phải type độc quyền của trang bác sĩ — nếu sau này thêm field chỉ phục vụ màn tự-xem-hồ-sơ của bác sĩ, sẽ vô tình lộ ra ở màn admin dùng chung type này.

`DoctorSlot`/`Schedule`, `DoctorAppointmentDetail`, `DoctorStats`, `DoctorReview` — grep xác nhận không bị admin dùng chung, độc quyền cho trang bác sĩ.

## 5. Đề xuất type riêng cho trang bác sĩ (chỉ đề xuất — CHƯA sửa code)

1. **[Cao]** Thêm `DoctorMedicalRecord` (thay vì tiếp tục dùng `ExaminationResult` cho cả 2 mục đích):
   ```ts
   interface DoctorMedicalRecord {
     id: number
     appointment_id: number
     patient_id: number
     doctor_id: number
     nurse_id?: number | null
     status: 'draft' | 'waiting_doctor_confirm' | 'confirmed' | 'need_revision'
     chan_doan: string
     huong_dan_dieu_tri: string
     ghi_chu?: string | null
     revision_note?: string | null   // lý do bác sĩ yêu cầu chỉnh sửa
     ngay_tai_kham: string
     thuoc: PrescriptionDrug[]
     ngay_tao: string
   }
   ```
   Đi kèm với việc thiết kế lại model/controller backend (đã đề xuất ở `Audit - Ho so kham bac si`) — 2 việc phải làm cùng nhau.

2. **[Cao]** Thêm `DoctorLeaveRequest`:
   ```ts
   interface DoctorLeaveRequest {
     id: string
     bac_si_id: string
     ngay_nghi: string          // hoặc tu_ngay/den_ngay nếu nghỉ nhiều ngày
     ca_nghi?: string | null
     ly_do: string
     trang_thai: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy'
     ghi_chu_admin?: string | null
     ngay_tao: string
   }
   ```

3. **[Trung bình]** Thêm `DoctorDashboardOverview` (khác với `DoctorStats` hiện có — bổ sung phần "hôm nay" thay vì tích lũy):
   ```ts
   interface DoctorDashboardOverview {
     ca_lam_viec_hom_nay?: { gio_bat_dau: string; gio_ket_thuc: string; phong_kham: string | null } | null
     y_ta_ho_tro?: string | null
     tong_lich_hen_hom_nay: number
     cho_kham: number
     dang_kham: number
     hoan_thanh: number
     lich_hen_gan_nhat: DoctorAppointmentDetail[]
   }
   ```

4. **[Thấp]** Cân nhắc tách `DoctorAppointmentSummary` (nhẹ, dùng cho bảng danh sách) khỏi `DoctorAppointmentDetail` (đầy đủ, dùng cho trang chi tiết) — hiện đang dùng chung 1 type cho cả 2 mục đích. Không bắt buộc vì backend hiện cũng trả cùng shape cho cả list và detail, nhưng nếu sau này thêm field nặng vào detail thì nên tách để tránh bảng danh sách tải dữ liệu thừa.

5. **[Thấp]** Bổ sung field `y_ta`/`nurse` (tên, id) vào cả `DoctorSlot` và `DoctorAppointmentDetail` khi backend có field tương ứng.

## 6. Trạng thái thực hiện

Không sửa code/type nào ở bước này — chỉ kiểm tra và ghi nhận. Không đụng vào `DoctorProfile` dù phát hiện dùng chung với admin, vì chưa chắc chắn về tác động.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc.
- `Audit - Danh sach lich hen bac si (2026-07-08).md` — audit danh sách lịch hẹn.
- `Audit - Chi tiet lich hen bac si (2026-07-08).md` — audit chi tiết lịch hẹn.
- `Audit - Ho so kham bac si (2026-07-08).md` — audit hồ sơ khám.
- `Audit - Xin nghi bac si (2026-07-08).md` — audit chức năng xin nghỉ.
- `Audit - Logic 6 ngay lam viec (2026-07-08).md` — audit logic 6 ngày làm việc.
- `Audit - Service va API trang bac si (2026-07-08).md` — audit service/API.
